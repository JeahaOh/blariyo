package com.blariyo.collector.run;

import com.blariyo.collector.source.*;
import com.blariyo.collector.shared.CollectorFailure;
import java.net.URI;
import java.time.*;
import java.util.*;

/** Bounded discovery; actual candidate processing is exclusively the existing collection pipeline. */
public final class DiscoveryBatch {
  public record Options(String source, String chart, int maxPages, int maxItems, Duration since,
                        long intervalMillis, boolean writeDb) {
    public Options {
      if (source == null || !source.matches("[a-z][a-z0-9-]{1,40}") || chart == null || !chart.matches("[a-z]{1,20}")
          || maxPages < 1 || maxPages > 10 || maxItems < 1 || maxItems > 100
          || since == null || since.compareTo(Duration.ofHours(1)) < 0 || since.compareTo(Duration.ofHours(720)) > 0
          || intervalMillis < 10000 || intervalMillis > 3600000) throw new CollectorFailure(400, "BATCH_OPTIONS_INVALID");
    }
  }
  public interface Fetcher { byte[] fetch(URI uri); }
  public interface Sink { Map<String, Object> submit(String key, String canonicalUrl); }
  public record Report(String source, String state, String reason, int pages, int discovered,
                       int eligible, int duplicates, int unknownDates, List<Map<String, Object>> jobs) {}

  public Report run(SourceRegistry.Source source, Options options, Fetcher fetcher, Sink sink, Instant now) {
    int pages = 0, eligible = 0, duplicates = 0, unknown = 0;
    var seenPosts = new HashSet<String>();
    var seenUrls = new HashSet<String>();
    var visited = new HashSet<URI>();
    var jobs = new ArrayList<Map<String, Object>>();
    try {
      String reason = source.config().path("blockedReason").asText();
      if (!reason.isBlank()) throw new CollectorFailure(403, reason);
      var adapter = source.adapter();
      var policy = source.policy();
      if (!source.config().path("batchApproved").asBoolean(false)) throw new CollectorFailure(403, "BATCH_NOT_APPROVED");
      if (options.maxPages() > source.config().path("maxPages").asInt(2)
          || options.maxItems() > source.config().path("maxItems").asInt(20)
          || options.intervalMillis() < source.config().path("requestIntervalMs").asLong(10000))
        throw new CollectorFailure(400, "SOURCE_LIMIT_EXCEEDED");
      String chart = source.config().path("charts").path(options.chart()).asText();
      if (!source.config().path("chartVerified").asBoolean(false) || chart.isBlank()) throw new CollectorFailure(403, "CHART_UNVERIFIED");
      URI next = policy.allow(chart);
      Instant cutoff = now.minus(options.since());
      while (next != null && pages < options.maxPages() && seenPosts.size() < options.maxItems()) {
        if (!visited.add(next)) throw new CollectorFailure(422, "PAGINATION_LOOP");
        policy.allow(next.toString());
        var page = adapter.list(fetcher.fetch(next), next);
        pages++;
        for (var entry : page.entries()) {
          var id = entry.identity();
          String canonical = id.canonical().toString();
          if (seenPosts.contains(id.postKey()) || seenUrls.contains(canonical)) { duplicates++; continue; }
          if (seenPosts.size() >= options.maxItems()) break;
          seenPosts.add(id.postKey()); seenUrls.add(canonical);
          if (entry.publishedAt() == null) { unknown++; continue; }
          if (entry.publishedAt().isBefore(cutoff) || entry.publishedAt().isAfter(now.plusSeconds(300))) continue;
          eligible++;
          if (options.writeDb()) {
            try {
              // A durable Core URL/post-key constraint is still authoritative across runs and machines.
              jobs.add(sink.submit(source.key() + ":" + id.postKey(), canonical));
            } catch (CollectorFailure e) {
              if (e.getMessage().endsWith("CANDIDATE_DUPLICATE")) duplicates++;
              else throw e;
            }
          }
        }
        next = page.next();
      }
      return new Report(source.key(), unknown > 0 ? "PARTIAL" : options.writeDb() ? "QUEUED" : "DISCOVERED",
          unknown > 0 ? "PUBLISHED_AT_UNKNOWN" : "NONE", pages, seenPosts.size(), eligible, duplicates, unknown, List.copyOf(jobs));
    } catch (CollectorFailure e) {
      return new Report(source.key(), jobs.isEmpty() && e.status() == 403 ? "BLOCKED" : "FAILED", e.getMessage(),
          pages, seenPosts.size(), eligible, duplicates, unknown, List.copyOf(jobs));
    }
  }
}
