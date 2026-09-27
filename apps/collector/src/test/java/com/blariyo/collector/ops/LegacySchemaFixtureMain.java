package com.blariyo.collector.ops;

import com.blariyo.collector.shared.Json;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;

/** Restores the immutable V001--V006 installation contract for a disposable backup fixture. */
public final class LegacySchemaFixtureMain {
  public static void main(String[] args) throws Exception {
    if (args.length != 1 || !args[0].matches("jdbc:postgresql://127\\.0\\.0\\.1:55449/backup_[a-z0-9_]+"))
      throw new IllegalArgumentException("ISOLATED_FIXTURE_REQUIRED");
    String batch = resource("org/springframework/batch/core/schema-postgresql.sql");
    String quartz = resource("org/quartz/impl/jdbcjobstore/tables_postgres.sql")
        .replaceAll("(?im)^DROP TABLE[^;]*;\\s*", "");
    String own = resource("db/collector-v001.sql");
    try (var db = DriverManager.getConnection(args[0], "postgres", ""); var sql = db.createStatement()) {
      db.setAutoCommit(false);
      sql.execute("CREATE SCHEMA collector; CREATE SCHEMA batch; CREATE SCHEMA quartz;"
          + " CREATE TABLE collector.schema_migration(version VARCHAR(20) PRIMARY KEY,"
          + " checksum CHAR(64) NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now());"
          + " SET LOCAL search_path=batch");
      sql.execute(batch);
      sql.execute("SET LOCAL search_path=quartz"); sql.execute(quartz);
      sql.execute("SET LOCAL search_path=collector"); sql.execute(own);
      try (var record = db.prepareStatement("INSERT INTO collector.schema_migration(version,checksum) VALUES(?,?)")) {
        record.setString(1, "V001");
        record.setString(2, Json.sha((batch + quartz + own).getBytes(StandardCharsets.UTF_8)));
        record.executeUpdate();
        for (int i = 2; i <= 6; i++) {
          String version = "V%03d".formatted(i);
          String migration = resource("db/collector-v%03d.sql".formatted(i));
          sql.execute(migration);
          record.setString(1, version);
          record.setString(2, Json.sha(migration.getBytes(StandardCharsets.UTF_8)));
          record.executeUpdate();
        }
      }
      db.commit();
    }
  }

  private static String resource(String name) throws Exception {
    try (var stream = LegacySchemaFixtureMain.class.getClassLoader().getResourceAsStream(name)) {
      if (stream == null) throw new IllegalStateException("SCHEMA_RESOURCE_MISSING");
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
