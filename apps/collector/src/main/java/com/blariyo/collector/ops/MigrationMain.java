package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.shared.Json;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.sql.*;

/** Explicit migration entry point; normal server startup never performs DDL. */
public final class MigrationMain {
  private static final Map<String, String> LEGACY_CHECKSUMS = Map.of(
      "V001", "875f7f62e722cf53d18e398a2abd151442a1b56ecd5a21f956edbcf7565dccbd",
      "V002", "91dbe732b97cf27e16fec72e5510d94811b17b7ab1c16f26733a8333a446393b",
      "V003", "4c9ffece0d9a5d234aaaa637e6449d6de2d09228d06eb1a67aa72c1166a18e84",
      "V004", "6a175550e3e978cfc305ce61ddfb6f78db44b53962d0b42d719a27118c51c79a",
      "V005", "dc1eca00a275e9cfe2692acd53ce7334a37bd2d4e36ab5357d3fcc50e628fb3c",
      "V006", "667212ed76ebdc1adb4954676196ff0e48ebd412bdf6614f4ed0bdea084a3a9f");

  public static void main(String[] args) {
    try {
      if (args.length == 1) OperatorSettings.load(args[0]);
      else if (args.length > 1) throw new IllegalArgumentException();
      migrate(OperatorSettings.url(), OperatorSettings.user(), OperatorSettings.password());
      System.out.println("COLLECTOR_MIGRATION_COMPLETE");
    } catch (Exception e) {
      System.err.println("COLLECTOR_MIGRATION_FAILED code=" + failureCode(e));
      System.exit(1);
    }
  }

  public static void migrate(String url, String user, String password) throws Exception {
    String batch = resource("org/springframework/batch/core/schema-postgresql.sql");
    String quartz =
        resource("org/quartz/impl/jdbcjobstore/tables_postgres.sql")
            .replaceAll("(?im)^DROP TABLE[^;]*;\\s*", "");
    String own = resource("db/collector-v001.sql"),
        checksum = Json.sha((batch + quartz + own).getBytes(StandardCharsets.UTF_8));
    try (Connection db = DriverManager.getConnection(url, user, password);
        Statement sql = db.createStatement()) {
      db.setAutoCommit(false);
      try {
        sql.execute("SELECT pg_advisory_xact_lock(72189402)");
        sql.execute("CREATE SCHEMA IF NOT EXISTS collector");
        sql.execute(
            "CREATE TABLE IF NOT EXISTS collector.schema_migration(version VARCHAR(20) PRIMARY"
                + " KEY,checksum CHAR(64) NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
        try (var r =
            sql.executeQuery(
                "SELECT checksum FROM collector.schema_migration WHERE version='V001'")) {
          if (r.next()) {
            if (!checksumMatches("V001", checksum, r.getString(1)))
              throw new IllegalStateException("MIGRATION_CHECKSUM");
            apply(db,"V002");
            apply(db,"V003");
            apply(db,"V004");
            apply(db,"V005");
            apply(db,"V006");
            db.commit();
            return;
          }
        }
        sql.execute("CREATE SCHEMA IF NOT EXISTS batch;CREATE SCHEMA IF NOT EXISTS quartz;SET LOCAL search_path=batch");
        sql.execute(batch);
        sql.execute("SET LOCAL search_path=quartz");
        sql.execute(quartz);
        sql.execute("SET LOCAL search_path=collector");
        sql.execute(own);
        try (var insert =
            db.prepareStatement(
                "INSERT INTO collector.schema_migration(version,checksum) VALUES('V001',?)")) {
          insert.setString(1, checksum);
          insert.executeUpdate();
        }
        apply(db,"V002");
        apply(db,"V003");
        apply(db,"V004");
        apply(db,"V005");
        apply(db,"V006");
        db.commit();
      } catch (Exception e) {
        db.rollback();
        throw e;
      }
    }
  }

  private static void apply(Connection db,String version) throws Exception {
    String own = resource("db/collector-"+version.toLowerCase(java.util.Locale.ROOT)+".sql"),
        checksum = Json.sha(own.getBytes(StandardCharsets.UTF_8));
    try (var schema = db.createStatement()) {
      schema.execute("CREATE SCHEMA IF NOT EXISTS collect");
    }
    try (var check=db.prepareStatement("SELECT checksum FROM collector.schema_migration WHERE version=?")) {
      check.setString(1, version);
      try (var r = check.executeQuery()) {
        if (r.next()) {
          if (!checksumMatches(version, checksum, r.getString(1)))
            throw new IllegalStateException("MIGRATION_CHECKSUM_"+version);
          return;
        }
      }
    }
    try (var sql = db.createStatement()) {
      sql.execute(own);
    }
    try (var insert =
        db.prepareStatement("INSERT INTO collector.schema_migration(version,checksum) VALUES(?,?)")) {
      insert.setString(1, version);
      insert.setString(2, checksum);
      insert.executeUpdate();
    }
  }

  private static boolean checksumMatches(String version, String current, String applied) {
    return current.equals(applied) || LEGACY_CHECKSUMS.get(version).equals(applied);
  }

  private static String failureCode(Exception error) {
    if (error instanceof IllegalArgumentException) return "INVALID_ARGUMENT";
    if (error instanceof IllegalStateException && error.getMessage() != null
        && error.getMessage().matches("[A-Z][A-Z0-9_]{1,80}")) return error.getMessage();
    if (error instanceof SQLException sql && sql.getSQLState() != null)
      return "SQLSTATE_" + sql.getSQLState().replaceAll("[^A-Za-z0-9]", "");
    return error.getClass().getSimpleName().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
  }

  private static String resource(String name) throws Exception {
    try (var in = MigrationMain.class.getClassLoader().getResourceAsStream(name)) {
      if (in == null) throw new IllegalStateException("SCHEMA_RESOURCE_MISSING");
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
