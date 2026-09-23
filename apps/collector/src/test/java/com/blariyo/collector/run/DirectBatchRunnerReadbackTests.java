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
  private static final byte[] PNG=java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=");
  @Test void failedAndAbandonedItemsResumeWithoutDuplicatingOrChangingFetchedSnapshot(@TempDir Path root) throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank(),"COLLECTOR_READBACK_DATABASE_URL not set");
    var config=new HikariConfig();config.setJdbcUrl(jdbc);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));config.setMaximumPoolSize(3);
    try(var ds=new HikariDataSource(config)) {
      com.blariyo.collector.ops.MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());
      var store=new BatchStore(ds);String key=Long.toString(System.nanoTime());
      var fail=new java.util.concurrent.atomic.AtomicBoolean(true);
      var base=transport(key);
      SourceTransport network=new SourceTransport(){
        public void validate(URI uri){}
        public PinnedHttp.Response get(URI uri,int maximum,String agent) {
          if(uri.getPath().equals("/second.png")&&fail.get())return new PinnedHttp.Response(403,"text/html",Map.of(),new byte[0]);
          var r=base.get(uri,maximum,agent);
          if(uri.getPath().endsWith("/"+key))return new PinnedHttp.Response(200,"text/html",Map.of(),
            new String(r.bytes(),StandardCharsets.UTF_8).replace("</div></div>","<img src='https://cdn.fixture.invalid/second.png'></div></div>").getBytes(StandardCharsets.UTF_8));
          return r;
        }
      };
      var objects=new BatchObjectStore.Local(root.toString());
      var runner=new DirectBatchRunner(network,store,objects,ignored->{});
      var options=new DirectBatchRunner.Options("arcalive","hot",1,1,Duration.ofHours(24),10000,true);
      var failed=runner.run(source(key),options);assertEquals("BLOCKED",failed.state());assertEquals(1,failed.failures());
      java.util.UUID item;
      try(var c=ds.getConnection();var s=c.prepareStatement("SELECT id,state,raw_object_key,failure_code,(SELECT count(*) FROM collect.batch_media m WHERE m.item_id=i.id) AS media FROM collect.batch_item i WHERE source_post_key=?")) {
        s.setString(1,key);try(var row=s.executeQuery()){assertTrue(row.next());item=(java.util.UUID)row.getObject("id");assertEquals("BLOCKED",row.getString("state"));assertNotNull(row.getString("raw_object_key"));assertEquals("SOURCE_ACCESS_BLOCKED",row.getString("failure_code"));assertEquals(1,row.getInt("media"));}
      }
      // Another process cannot restart this source while its owner holds the lock.
      try(var lease=store.lockSource("arcalive")) {
        assertEquals("BATCH_SOURCE_BUSY",assertThrows(com.blariyo.collector.shared.CollectorFailure.class,()->store.lockSource("arcalive")).getMessage());
      }
      String firstKey;
      try(var c=ds.getConnection();var q=c.prepareStatement("SELECT object_key FROM collect.batch_media WHERE item_id=?")) {
        q.setObject(1,item);try(var r=q.executeQuery()){assertTrue(r.next());firstKey=r.getString(1);}
      }
      byte[] firstBytes=Files.readAllBytes(root.resolve(firstKey));
      fail.set(false);var resumed=runner.run(source(key),options);assertEquals("COMPLETED",resumed.state());assertEquals(1,resumed.fetched());
      try(var c=ds.getConnection();var s=c.prepareStatement("SELECT state,run_id,version,(SELECT count(*) FROM collect.batch_media m WHERE m.item_id=i.id) AS media FROM collect.batch_item i WHERE id=?")) {
        s.setObject(1,item);long version;
        try(var row=s.executeQuery()){assertTrue(row.next());assertEquals("FETCHED",row.getString("state"));assertEquals(resumed.runId(),row.getObject("run_id"));assertEquals(2,row.getInt("media"));version=row.getLong("version");}
        var duplicate=runner.run(source(key),options);assertEquals(1,duplicate.duplicates());assertEquals(0,duplicate.fetched());
        try(var row=s.executeQuery()){assertTrue(row.next());assertEquals(version,row.getLong("version"));}
      }
      assertArrayEquals(firstBytes,Files.readAllBytes(root.resolve(firstKey)));
      try(var c=ds.getConnection();var q=c.prepareStatement("SELECT object_key FROM collect.batch_media WHERE item_id=?")) {
        q.setObject(1,item);try(var r=q.executeQuery()){while(r.next())assertTrue(r.getString(1).startsWith("collect/media/"+resumed.runId()+"/"));}
      }
      // Simulate a stopped process with an incomplete raw snapshot; a new source lock can reclaim it.
      String crashKey=key+"1";java.util.UUID crashed;
      try(var lease=store.lockSource("arcalive")) {
        var run=store.begin("arcalive","hot","WRITE_DB",1,1,10000,Instant.now());
        crashed=store.item(run,"arcalive",crashKey,"https://arca.live/b/live/"+crashKey,"FETCHING","incomplete","[]","[]",null);
        store.raw(crashed,"collect/raw/abandoned/test.html");
      }
      var recovered=new DirectBatchRunner(transport(crashKey),store,objects,ignored->{}).run(source(crashKey),options);
      assertEquals(1,recovered.fetched());
      try(var c=ds.getConnection();var s=c.prepareStatement("SELECT state FROM collect.batch_item WHERE id=?")) {s.setObject(1,crashed);try(var row=s.executeQuery()){assertTrue(row.next());assertEquals("FETCHED",row.getString(1));}}
    }
  }
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
      com.blariyo.collector.ops.MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());

      String postKey = Long.toString(System.currentTimeMillis());
      var source = source(postKey);
      var report = new DirectBatchRunner(
          transport(postKey),
          new BatchStore(dataSource),
          new BatchObjectStore.Local(objectRoot.toString()),
          ignored -> {})
          .run(source, new DirectBatchRunner.Options("arcalive", "hot", 1, 1, Duration.ofHours(24), 10000, true));

      assertEquals("COMPLETED", report.state(), report.toString());
      assertEquals(1, report.fetched());
      try (var connection = dataSource.getConnection();
           var item = connection.prepareStatement(
               "SELECT id, title, body_blocks, sns_links, raw_object_key, fetched_at FROM collect.batch_item WHERE source_key=? AND source_post_key=?")) {
        item.setString(1, "arcalive");
        item.setString(2, postKey);
        try (var rows = item.executeQuery()) {
          assertTrue(rows.next());
          assertEquals("fixture title", rows.getString("title"));
          assertTrue(rows.getString("body_blocks").contains("fixture body"));
          assertTrue(rows.getString("sns_links").contains("x.com/fixture/status/123"));
          assertNotNull(rows.getTimestamp("fetched_at"));
          assertTrue(Files.exists(objectRoot.resolve(rows.getString("raw_object_key"))));
          try (var media = connection.prepareStatement(
              "SELECT object_key, mime_type, byte_size, sha256 FROM collect.batch_media WHERE item_id=?")) {
            media.setObject(1, rows.getObject("id"));
            try (var mediaRows = media.executeQuery()) {
              assertTrue(mediaRows.next());
              assertEquals("image/png", mediaRows.getString("mime_type"));
              assertEquals(PNG.length, mediaRows.getLong("byte_size"));
              assertEquals(32, mediaRows.getBytes("sha256").length);
              assertTrue(Files.exists(objectRoot.resolve(mediaRows.getString("object_key"))));
            }
          }
        }
      }
      try (var connection = dataSource.getConnection();
           var runs = connection.prepareStatement("SELECT r.report_object_key,p.sha256,p.jsonl_count,c.state FROM collect.batch_run r JOIN collect.batch_report p ON p.run_id=r.id JOIN collect.batch_checkpoint c ON c.run_id=r.id WHERE r.id=?")) {
        runs.setObject(1, report.runId());
        try (var rows = runs.executeQuery()) {
          assertTrue(rows.next());
          Path reportPath = objectRoot.resolve(rows.getString("report_object_key"));
          assertTrue(Files.exists(reportPath));
          assertTrue(Files.readString(reportPath).contains("\"fetched\":1"));
          assertArrayEquals(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(reportPath)),rows.getBytes("sha256"));
          assertEquals(1,rows.getLong("jsonl_count"));
          assertEquals(1,Json.parse(rows.getString("state").getBytes(StandardCharsets.UTF_8)).path("fetched").asInt());
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
          return new PinnedHttp.Response(200, "image/png", Map.of(), PNG);
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
