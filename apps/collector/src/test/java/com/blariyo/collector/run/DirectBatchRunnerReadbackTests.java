package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.PinnedHttp;
import com.blariyo.collector.source.SourceRegistry;
import com.blariyo.collector.source.SourceTransport;
import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DirectBatchRunnerReadbackTests {
  @Test
  void writeDbStoresRawMediaAndRowsThenReadsThemBack(@TempDir Path objectRoot) throws Exception {
    String jdbc = System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc != null && !jdbc.isBlank(), "COLLECTOR_READBACK_DATABASE_URL not set");
    var config = new HikariConfig();
    config.setJdbcUrl(jdbc);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER", "blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD", ""));
    config.setMaximumPoolSize(2);
    try (var dataSource = new HikariDataSource(config)) {
      try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
        statement.execute("CREATE SCHEMA IF NOT EXISTS collect");
        for (String sql : new String(DirectBatchRunnerReadbackTests.class.getClassLoader()
            .getResourceAsStream("db/collector-v002.sql").readAllBytes(), StandardCharsets.UTF_8).split(";\\s*\\R")) {
          if (!sql.strip().isEmpty()) statement.execute(sql);
        }
      }

      String postKey = Long.toString(System.currentTimeMillis());
      var source = source(postKey);
      var report = new DirectBatchRunner(
          transport(postKey),
          new BatchStore(dataSource),
          new BatchObjectStore.Local(objectRoot.toString()))
          .run(source, new DirectBatchRunner.Options("arcalive", "hot", 1, 1, Duration.ofHours(24), 10000, true));

      assertEquals("COMPLETED", report.state(), report.toString());
      assertEquals(1, report.fetched());
      try (var connection = dataSource.getConnection();
           var item = connection.prepareStatement(
               "SELECT id, title, body_blocks, sns_links, raw_object_key FROM collect.batch_item WHERE source_key=? AND source_post_key=?")) {
        item.setString(1, "arcalive");
        item.setString(2, postKey);
        try (var rows = item.executeQuery()) {
          assertTrue(rows.next());
          assertEquals("fixture title", rows.getString("title"));
          assertTrue(rows.getString("body_blocks").contains("fixture body"));
          assertTrue(rows.getString("sns_links").contains("x.com/fixture/status/123"));
          assertTrue(Files.exists(objectRoot.resolve(rows.getString("raw_object_key"))));
          try (var media = connection.prepareStatement(
              "SELECT object_key, mime_type, byte_size, sha256 FROM collect.batch_media WHERE item_id=?")) {
            media.setObject(1, rows.getObject("id"));
            try (var mediaRows = media.executeQuery()) {
              assertTrue(mediaRows.next());
              assertEquals("image/png", mediaRows.getString("mime_type"));
              assertEquals(4L, mediaRows.getLong("byte_size"));
              assertEquals(32, mediaRows.getBytes("sha256").length);
              assertTrue(Files.exists(objectRoot.resolve(mediaRows.getString("object_key"))));
            }
          }
        }
      }
    }
  }

  private static SourceRegistry.Source source(String postKey) {
    return new SourceRegistry(Json.tree(Map.of("arcalive", Map.ofEntries(
        Map.entry("host", "arca.live"),
        Map.entry("approved", true),
        Map.entry("batchApproved", true),
        Map.entry("chartVerified", true),
        Map.entry("parser", "ARCALIVE"),
        Map.entry("pathPrefixes", List.of("/")),
        Map.entry("userAgent", "fixture contact-fixture.invalid"),
        Map.entry("imageOrigins", Map.of("https://cdn.fixture.invalid", List.of("/"))),
        Map.entry("charts", Map.of("hot", "https://arca.live/b/live")),
        Map.entry("maxPages", 1),
        Map.entry("maxItems", 1),
        Map.entry("requestIntervalMs", 10000))))).key("arcalive");
  }

  private static SourceTransport transport(String postKey) {
    return new SourceTransport() {
      public void validate(URI uri) {}

      public PinnedHttp.Response get(URI uri, int maximum, String userAgent) {
        if (uri.getHost().equals("cdn.fixture.invalid"))
          return new PinnedHttp.Response(200, "image/png", Map.of(), new byte[] {1, 2, 3, 4});
        if (uri.getPath().endsWith("/" + postKey)) {
          String html = "<html><head><meta property='og:title' content='fixture title'></head><body>"
              + "<div class='article-view'><div class='article-content'>"
              + "<p>fixture body https://x.com/fixture/status/123</p>"
              + "<img src='https://cdn.fixture.invalid/" + postKey + ".png'>"
              + "</div></div></body></html>";
          return new PinnedHttp.Response(200, "text/html", Map.of(), html.getBytes(StandardCharsets.UTF_8));
        }
        String list = "<div class='article-list'><div class='vrow'><a class='title' href='/b/live/" + postKey
            + "'>fixture</a><time datetime='" + Instant.now() + "'></time></div></div>";
        return new PinnedHttp.Response(200, "text/html", Map.of(), list.getBytes(StandardCharsets.UTF_8));
      }
    };
  }
}
