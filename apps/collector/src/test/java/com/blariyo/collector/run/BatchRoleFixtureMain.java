package com.blariyo.collector.run;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Separate-process role test: real pipeline/DB/object writes, synthetic HTTP transport only. */
public final class BatchRoleFixtureMain {
  public static void main(String[] args) throws Exception {
    var config = new HikariConfig();
    config.setJdbcUrl(OperatorSettings.url());
    config.setUsername(OperatorSettings.user());
    config.setPassword(OperatorSettings.password());
    config.setMaximumPoolSize(2);
    byte[] image = Files.readAllBytes(Path.of(System.getenv("ROLE_FIXTURE_IMAGE")));
    var source = new SourceRegistry(Json.tree(Map.of("theqoo", Map.ofEntries(
        Map.entry("host", "theqoo.net"), Map.entry("approved", true),
        Map.entry("blockedReason", ""), Map.entry("parser", "THEQOO"),
        Map.entry("pathPrefixes", List.of("/hot/")), Map.entry("userAgent", "role-test contact-fixture"),
        Map.entry("imageOrigins", Map.of("https://img.theqoo.net", List.of("/"))),
        Map.entry("charts", Map.of()), Map.entry("chartVerified", false),
        Map.entry("batchApproved", false))))).key("theqoo");
    var transport = new SourceTransport() {
      public void validate(URI uri) {}
      public PinnedHttp.Response get(URI uri, int maximum, String userAgent) {
        if (uri.getHost().equals("img.theqoo.net")) return new PinnedHttp.Response(200,
            uri.getPath().endsWith(".pdf") ? "application/pdf" : "image/png", Map.of(),
            uri.getPath().endsWith(".pdf") ? "%PDF-1.4 role fixture".getBytes(StandardCharsets.UTF_8) : image);
        return new PinnedHttp.Response(200, "text/html", Map.of(),
            ("<html><head><meta property='og:title' content='Role fixture'></head><body>"
            + "<article itemprop='articleBody'><p>Original text https://x.com/fixture/status/123456789</p>"
            + "<img src='https://img.theqoo.net/one.png'><a href='https://img.theqoo.net/file.pdf'>attachment</a>"
            + "</article></body></html>").getBytes(StandardCharsets.UTF_8));
      }
    };
    try (var db = new HikariDataSource(config)) {
      var runner = new DirectUrlRunner(transport, new BatchStore(db), BatchObjectStore.fromEnvironment(), ignored -> {});
      var options = new DirectUrlRunner.Options("theqoo", "https://theqoo.net/hot/1234567890", 10000, true);
      var first = runner.run(source, options);
      if (!first.state().equals("COMPLETED") || first.fetched()!=1) throw new IllegalStateException("ROLE_FIXTURE_"+first.state()+"_"+String.join("_",first.errors()));
      var duplicate = runner.run(source, options);
      if (!duplicate.state().equals("COMPLETED") || duplicate.duplicates()!=1) throw new IllegalStateException("ROLE_DEDUP_FAILED");
      System.out.println("ROLE_BATCH_PIPELINE_PASS");
    }
  }
}
