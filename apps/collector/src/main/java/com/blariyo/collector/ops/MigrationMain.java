package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.shared.Json;
import java.nio.charset.StandardCharsets;
import java.sql.*;

/** Explicit migration entry point; normal server startup never performs DDL. */
public final class MigrationMain {
  public static void main(String[] args) {
    try {
      if (args.length == 1) OperatorSettings.load(args[0]);
      else if (args.length > 1) throw new IllegalArgumentException();
      migrate(OperatorSettings.url(), OperatorSettings.user(), OperatorSettings.password());
      System.out.println("COLLECTOR_MIGRATION_COMPLETE");
    } catch (Exception e) {
      System.err.println("COLLECTOR_MIGRATION_FAILED");
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
            if (!checksum.equals(r.getString(1)))
              throw new IllegalStateException("MIGRATION_CHECKSUM");
            db.commit();
            return;
          }
        }
        sql.execute("CREATE SCHEMA batch;CREATE SCHEMA quartz;SET LOCAL search_path=batch");
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
        db.commit();
      } catch (Exception e) {
        db.rollback();
        throw e;
      }
    }
  }

  private static String resource(String name) throws Exception {
    try (var in = MigrationMain.class.getClassLoader().getResourceAsStream(name)) {
      if (in == null) throw new IllegalStateException("SCHEMA_RESOURCE_MISSING");
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
