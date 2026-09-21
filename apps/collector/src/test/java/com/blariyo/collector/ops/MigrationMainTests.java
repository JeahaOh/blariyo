package com.blariyo.collector.ops;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.DriverManager;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class MigrationMainTests {
  @Test
  void migrationRecordsV001AndV002AndIsIdempotent() throws Exception {
    String jdbc = System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc != null && !jdbc.isBlank(), "COLLECTOR_READBACK_DATABASE_URL not set");
    String user = System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER", "blariyo_local");
    String password = System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD", "");

    MigrationMain.migrate(jdbc, user, password);
    MigrationMain.migrate(jdbc, user, password);

    try (var connection = DriverManager.getConnection(jdbc, user, password);
        var versions = connection.createStatement()
            .executeQuery("SELECT version FROM collector.schema_migration ORDER BY version")) {
      var found = new TreeSet<String>();
      while (versions.next()) found.add(versions.getString(1));
      assertTrue(found.containsAll(Set.of("V001", "V002")), found.toString());
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
