package com.blariyo.collector.source;

import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

/** Every live list/robots/redirect/retry consumes the same Core source budget as detail fetches. */
public final class DiscoveryFetcher {
  private final SourcePolicy policy;
  private final SourceTransport transport;
  private final CoreClient core;
  private final long sourceId;
  private final UUID execution = UUID.randomUUID();
  private long interval, nextAllowed;
  private RobotsRules robots;
  public DiscoveryFetcher(SourcePolicy policy, SourceTransport transport, CoreClient core, long sourceId, long interval) {
    if (sourceId < 1) throw new CollectorFailure(503, "CORE_SOURCE_ID_REQUIRED");
    this.policy = policy; this.transport = transport; this.core = core; this.sourceId = sourceId; this.interval = interval;
  }
  public byte[] fetch(URI url) {
    policy.allow(url.toString());
    if (robots == null) {
      var response = request(URI.create("https://" + policy.host() + "/robots.txt"), "ROBOTS", 512 * 1024, true);
      if (!response.contentType().toLowerCase(Locale.ROOT).startsWith("text/plain"))
        throw new CollectorFailure(403, "ROBOTS_UNVERIFIED");
      robots = new RobotsRules(new String(response.bytes(), StandardCharsets.UTF_8));
      interval = Math.max(interval, robots.delayMillis(policy.userAgent()));
      nextAllowed = Math.max(nextAllowed, System.nanoTime() + interval * 1_000_000);
    }
    if (!robots.allows(policy.userAgent(), url)) throw new CollectorFailure(403, "ROBOTS_DISALLOWED");
    var result = request(url, "LIST", 2 * 1024 * 1024, false);
    if (!result.contentType().toLowerCase(Locale.ROOT).startsWith("text/html")) throw new CollectorFailure(415, "SOURCE_NOT_HTML");
    return result.bytes();
  }
  private PinnedHttp.Response request(URI initial, String kind, int limit, boolean robot) {
    URI url = initial;
    for (int hop = 0; hop <= 3; hop++) {
      if (robot) new SourcePolicy(policy.host(), List.of("/robots.txt"), "", "", policy.userAgent()).allow(url.toString());
      else {
        policy.allow(url.toString());
        if (!robots.allows(policy.userAgent(), url)) throw new CollectorFailure(403, "ROBOTS_DISALLOWED");
      }
      PinnedHttp.Response response = null;
      for (int attempt = 0; attempt < 3; attempt++) {
        waitUntil(nextAllowed);
        transport.validate(url);
        String key = UUID.randomUUID().toString();
        long start = System.nanoTime();
        var permit = core.post("/sources/" + sourceId + "/request-reservations", key, Json.tree(Map.of(
            "collectorId", core.collectorId(), "collectorExecutionId", execution.toString(),
            "jobRequestId", execution.toString(), "requestKey", key, "requestKind", hop == 0 ? kind : "REDIRECT", "discovery", true)));
        long lifetime = Duration.between(Instant.parse(permit.path("serverNow").asText()),
            Instant.parse(permit.path("validUntil").asText())).toNanos() - (System.nanoTime() - start);
        if (lifetime < 2_000_000_000L) throw new CollectorFailure(409, "COLLECTOR_CLOCK_UNSAFE");
        nextAllowed = System.nanoTime() + Math.max(interval * 1_000_000,
            Duration.between(Instant.parse(permit.path("serverNow").asText()), Instant.parse(permit.path("nextAllowedAt").asText())).toNanos());
        try { response = transport.get(url, limit, policy.userAgent()); }
        catch (CollectorFailure e) {
          if (attempt == 2 || !Set.of("SOURCE_FETCH_FAILED", "SOURCE_DNS_FAILED").contains(e.getMessage())) throw e;
          nextAllowed = Math.max(nextAllowed, System.nanoTime() + (1L << attempt) * 1_000_000_000L);
          continue;
        }
        if (response.status() < 500 || attempt == 2) break;
        nextAllowed = Math.max(nextAllowed, System.nanoTime() + (1L << attempt) * 1_000_000_000L);
      }
      if (response == null) throw new CollectorFailure(503, "SOURCE_FETCH_FAILED");
      if (response.status() == 403 || response.status() == 429)
        throw new CollectorFailure(403, response.status() == 403 ? "SOURCE_ACCESS_BLOCKED" : "SOURCE_RATE_LIMITED");
      if (response.status() >= 300 && response.status() < 400 && hop < 3) {
        String location = response.headers().getOrDefault("location", List.of("")).getFirst();
        if (location.isBlank()) throw new CollectorFailure(403, "SOURCE_REDIRECT_BLOCKED");
        // A changed list base needs a new reviewed chart; do not resolve relative links against the old URL.
        if (!robot) throw new CollectorFailure(403, "SOURCE_REDIRECT_REVIEW_REQUIRED");
        url = url.resolve(location); continue;
      }
      if (response.status() != 200) throw new CollectorFailure(403,
          robot ? "ROBOTS_UNVERIFIED" : response.status() == 404 || response.status() == 410 ? "SOURCE_GONE" : "SOURCE_HTTP_FAILED");
      return response;
    }
    throw new CollectorFailure(403, "SOURCE_REDIRECT_BLOCKED");
  }
  private static void waitUntil(long deadline) {
    while (System.nanoTime() < deadline) {
      try { Thread.sleep(Math.min(250, Math.max(1, (deadline - System.nanoTime()) / 1_000_000))); }
      catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new CollectorFailure(409, "STOP_REQUESTED"); }
    }
  }
}
