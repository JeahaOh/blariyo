package com.blariyo.collector.ops;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.DriverManager;
import java.nio.charset.StandardCharsets;
import com.blariyo.collector.shared.Json;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class MigrationMainTests {
  private static final Map<String, String> LEGACY_CHECKSUMS = Map.of(
          "V001", "875f7f62e722cf53d18e398a2abd151442a1b56ecd5a21f956edbcf7565dccbd",
          "V002", "91dbe732b97cf27e16fec72e5510d94811b17b7ab1c16f26733a8333a446393b",
          "V003", "4c9ffece0d9a5d234aaaa637e6449d6de2d09228d06eb1a67aa72c1166a18e84",
          "V004", "6a175550e3e978cfc305ce61ddfb6f78db44b53962d0b42d719a27118c51c79a",
          "V005", "dc1eca00a275e9cfe2692acd53ce7334a37bd2d4e36ab5357d3fcc50e628fb3c",
          "V006", "667212ed76ebdc1adb4954676196ff0e48ebd412bdf6614f4ed0bdea084a3a9f");

  @Test
  void checksumCompatibilityLocksBothSides() throws Exception {
    String batch = schema("org/springframework/batch/core/schema-postgresql.sql");
    String quartz = schema("org/quartz/impl/jdbcjobstore/tables_postgres.sql")
        .replaceAll("(?im)^DROP TABLE[^;]*;\\s*", "");
    for (var entry : LEGACY_CHECKSUMS.entrySet()) {
      String version = entry.getKey();
      String sql = schema("db/collector-" + version.toLowerCase(java.util.Locale.ROOT) + ".sql");
      String current = Json.sha(((version.equals("V001") ? batch + quartz : "") + sql)
          .getBytes(StandardCharsets.UTF_8));
      assertTrue(MigrationMain.checksumMatches(version, current, current), version);
      assertTrue(MigrationMain.checksumMatches(version, current, entry.getValue()), version);
      assertFalse(MigrationMain.checksumMatches(version, "1".repeat(64), entry.getValue()), version);
      assertFalse(MigrationMain.checksumMatches(version, current, "0".repeat(64)), version);
      assertFalse(MigrationMain.checksumMatches("V999", current, entry.getValue()), version);
      String other = version.equals("V001") ? "V002" : "V001";
      assertFalse(MigrationMain.checksumMatches(other, current, entry.getValue()), version);
    }
  }

  private static String schema(String path) throws Exception {
    try (var in = MigrationMainTests.class.getClassLoader().getResourceAsStream(path)) {
      assertNotNull(in, path);
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  @Test
  void migrationRecordsAllVersionsAndIsIdempotent() throws Exception {
    String jdbc = System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc != null && !jdbc.isBlank(), "COLLECTOR_READBACK_DATABASE_URL not set");
    String user = System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER", "blariyo_local");
    String password = System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD", "");

    MigrationMain.migrate(jdbc, user, password);
    MigrationMain.migrate(jdbc, user, password);
    try (var connection = DriverManager.getConnection(jdbc, user, password);
        var update = connection.prepareStatement(
            "UPDATE collector.schema_migration SET checksum=? WHERE version=?")) {
      for (var entry : LEGACY_CHECKSUMS.entrySet()) {
        update.setString(1, entry.getValue());
        update.setString(2, entry.getKey());
        assertEquals(1, update.executeUpdate());
      }
    }
    MigrationMain.migrate(jdbc, user, password);
    try (var connection = DriverManager.getConnection(jdbc, user, password);
        var update = connection.prepareStatement(
            "UPDATE collector.schema_migration SET checksum=? WHERE version='V002'")) {
      update.setString(1, "0".repeat(64));
      assertEquals(1, update.executeUpdate());
    }
    assertThrows(Exception.class, () -> MigrationMain.migrate(jdbc, user, password));
    try (var connection = DriverManager.getConnection(jdbc, user, password);
        var update = connection.prepareStatement(
            "UPDATE collector.schema_migration SET checksum=? WHERE version='V002'")) {
      update.setString(1, "91dbe732b97cf27e16fec72e5510d94811b17b7ab1c16f26733a8333a446393b");
      assertEquals(1, update.executeUpdate());
    }

    try (var connection = DriverManager.getConnection(jdbc, user, password);
        var versions = connection.createStatement()
            .executeQuery("SELECT version FROM collector.schema_migration ORDER BY version")) {
      var found = new TreeSet<String>();
      while (versions.next()) found.add(versions.getString(1));
      assertTrue(found.containsAll(Set.of("V001", "V002", "V003", "V004", "V005", "V006")), found.toString());
    }
    try (var connection = DriverManager.getConnection(jdbc, user, password);
        var objects = connection.createStatement()
            .executeQuery("SELECT to_regclass('collect.batch_run'), to_regclass('collect.batch_item'), to_regclass('collect.batch_media')")) {
      assertTrue(objects.next());
      assertNotNull(objects.getString(1));
      assertNotNull(objects.getString(2));
      assertNotNull(objects.getString(3));
    }
  }
}
