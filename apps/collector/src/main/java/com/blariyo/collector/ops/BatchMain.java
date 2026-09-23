package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.run.DirectBatchRunner;
import com.blariyo.collector.run.DirectUrlRunner;
import com.blariyo.collector.run.BatchStore;
import com.blariyo.collector.run.DiscoveryBatch;
import com.blariyo.collector.storage.BatchObjectStore;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;

/** Same Java entrypoint on macOS, PowerShell and a Linux Docker container. */
public final class BatchMain {
  public static DiscoveryBatch.Options options(String[] args) {
    if (args.length == 0 || !args[0].equals("batch")) throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
    var values = new HashMap<String, String>();
    var flags = new HashSet<String>();
    for (int i = 1; i < args.length; i++) {
      String key = args[i];
      if (Set.of("--dry-run", "--write-db").contains(key)) {
        if (!flags.add(key)) throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
      } else {
        if (!Set.of("--source", "--chart", "--max-pages", "--max-items", "--since", "--interval-ms").contains(key)
            || ++i == args.length || values.putIfAbsent(key, args[i]) != null)
          throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
      }
    }
    if (flags.size() != 1) throw new CollectorFailure(400, "BATCH_MODE_REQUIRED");
    String since = values.getOrDefault("--since", "24h");
    if (!since.matches("[1-9][0-9]{0,2}h")) throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
    return new DiscoveryBatch.Options(values.get("--source"), values.getOrDefault("--chart", "hot"),
        Integer.parseInt(values.getOrDefault("--max-pages", "2")), Integer.parseInt(values.getOrDefault("--max-items", "20")),
        Duration.ofHours(Long.parseLong(since.substring(0, since.length() - 1))),
        Long.parseLong(values.getOrDefault("--interval-ms", "10000")), flags.contains("--write-db"));
  }
  private static void collectUrl(String[] args) throws Exception {
    var values = new HashMap<String, String>();
    var flags = new HashSet<String>();
    for (int i = 1; i < args.length; i++) {
      String key = args[i];
      if (Set.of("--dry-run", "--write-db").contains(key)) {
        if (!flags.add(key)) throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
      } else {
        if (!Set.of("--source", "--url", "--interval-ms").contains(key)
            || ++i == args.length || values.putIfAbsent(key, args[i]) != null)
          throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
      }
    }
    if (flags.size() != 1 || !values.containsKey("--source") || !values.containsKey("--url"))
      throw new CollectorFailure(400, "BATCH_MODE_REQUIRED");
    String config = System.getenv("COLLECTOR_CONFIG_FILE");
    if (config != null && !config.isBlank()) OperatorSettings.load(config);
    String sourceFile = System.getenv().getOrDefault("COLLECTOR_SOURCE_CONFIG",
        OperatorSettings.get("collector.sources-file", "COLLECTOR_SOURCES_FILE",
            "apps/collector/ops/reference-sites.sources.example.json"));
    var source = SourceRegistry.read(sourceFile).key(values.get("--source"));
    long interval=Long.parseLong(values.getOrDefault("--interval-ms","10000"));
    if(interval<source.config().path("requestIntervalMs").asLong(10000)||interval>3600000)
      throw new CollectorFailure(400,"SOURCE_LIMIT_EXCEEDED");
    // Reject disallowed sources before opening a DB connection or reading object-store credentials.
    source.policy();
    com.zaxxer.hikari.HikariDataSource datasource = null;
    boolean write = flags.contains("--write-db");
    if (write) {
      var hikari = new com.zaxxer.hikari.HikariConfig();
      hikari.setJdbcUrl(OperatorSettings.url()); hikari.setUsername(OperatorSettings.user()); hikari.setPassword(OperatorSettings.password());
      hikari.setMaximumPoolSize(2); datasource = new com.zaxxer.hikari.HikariDataSource(hikari);
    }
    var report = new DirectUrlRunner(new PinnedHttp(), datasource == null ? null : new BatchStore(datasource),
        write ? BatchObjectStore.fromEnvironment() : null)
        .run(source, new DirectUrlRunner.Options(values.get("--source"), values.get("--url"),
            interval, write));
    if (datasource != null) datasource.close();
    System.out.println(Json.tree(Map.of("runId", report.runId().toString(), "mode", write ? "WRITE_DB" : "DRY_RUN", "report", report)));
    System.exit(switch (report.state()) { case "BLOCKED" -> 2; case "FAILED" -> 1; default -> 0; });
  }

  public static void main(String[] args) {
    try {
      if (args.length > 0 && Set.of("queue","discord").contains(args[0])) { QueueMain.execute(args); return; }
      if (args.length > 0 && args[0].equals("collect-url")) { collectUrl(args); return; }
      var options = options(args);
      String config = System.getenv("COLLECTOR_CONFIG_FILE");
      if (config != null && !config.isBlank()) OperatorSettings.load(config);
      String sourceFile = System.getenv().getOrDefault("COLLECTOR_SOURCE_CONFIG",
          OperatorSettings.get("collector.sources-file", "COLLECTOR_SOURCES_FILE",
              "apps/collector/ops/reference-sites.sources.example.json"));
      var source = SourceRegistry.read(sourceFile).key(options.source());
      String chart=Arrays.asList(args).contains("--chart")?options.chart():source.config().path("defaultChart").asText("hot");
      String blocked = source.config().path("blockedReason").asText();
      if (!blocked.isBlank() || !source.config().path("approved").asBoolean(false)) {
        var report = Map.of("runId", UUID.randomUUID().toString(), "mode", options.writeDb() ? "WRITE_DB" : "DRY_RUN",
            "report", Map.of("source", options.source(), "state", "BLOCKED", "reason", blocked.isBlank() ? "SOURCE_NOT_ALLOWED" : blocked));
        System.out.println(Json.tree(report)); System.exit(2); return;
      }
      // Resolve dependencies lazily: a blocked source never accesses credentials or opens sockets.
      com.zaxxer.hikari.HikariDataSource datasource = null;
      if (options.writeDb()) {
        var hikari = new com.zaxxer.hikari.HikariConfig();
        hikari.setJdbcUrl(OperatorSettings.url()); hikari.setUsername(OperatorSettings.user()); hikari.setPassword(OperatorSettings.password());
        hikari.setMaximumPoolSize(2); datasource = new com.zaxxer.hikari.HikariDataSource(hikari);
      }
      var report = new DirectBatchRunner(new PinnedHttp(), datasource == null ? null : new BatchStore(datasource),
          options.writeDb() ? BatchObjectStore.fromEnvironment() : null)
          .run(source, new DirectBatchRunner.Options(options.source(), chart, options.maxPages(), options.maxItems(), options.since(), options.intervalMillis(), options.writeDb()));
      if (datasource != null) datasource.close();
      System.out.println(Json.tree(Map.of("runId", report.runId().toString(), "mode", options.writeDb() ? "WRITE_DB" : "DRY_RUN",
          "report", report)));
      System.exit(switch (report.state()) { case "BLOCKED" -> 2; case "FAILED" -> 1; case "PARTIAL" -> 3; default -> 0; });
    } catch (Exception e) {
      if ("true".equalsIgnoreCase(System.getenv("COLLECTOR_DEBUG_ERRORS"))) e.printStackTrace(System.err);
      String code = e instanceof CollectorFailure ? e.getMessage() : "BATCH_CONFIGURATION_FAILED";
      System.out.println(Json.tree(Map.of("state", "FAILED", "reason", code)));
      System.exit(1);
    }
  }
}
