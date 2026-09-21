package com.blariyo.collector.run;

import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.SourcePolicy;
import java.net.URI;
import java.nio.file.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** Shared Discord/local URL boundary. No source fetch and no service DB access here. */
@Component
public final class CandidateIntake {
  private final CoreClient core;
  private final String sourcesFile;

  public CandidateIntake(CoreClient core, @Value("${collector.sources-file:}") String sourcesFile) {
    this.core = core;
    this.sourcesFile = sourcesFile;
  }

  public com.blariyo.collector.source.SourceRegistry.Source resolve(String url) {
    try {
      var source = com.blariyo.collector.source.SourceRegistry.read(sourcesFile).host(URI.create(url).getHost(), null);
      source.canonical(url);
      return source;
    } catch (CollectorFailure e) { throw e; }
    catch (Exception e) { throw new CollectorFailure(400, "VALIDATION_FAILED"); }
  }

  public JsonNode create(String key, String url) { return create(key, url, "MANUAL_URL"); }
  public JsonNode create(String key, String url, String discoveryMode) {
    if (!java.util.Set.of("MANUAL_URL", "LIST_CRAWL").contains(discoveryMode))
      throw new CollectorFailure(400, "VALIDATION_FAILED");
    if (url == null || url.isBlank() || url.length() > 2048)
      throw new CollectorFailure(400, "VALIDATION_FAILED");
    var source = resolve(url);
    url = source.canonical(url);
    if (discoveryMode.equals("LIST_CRAWL") && !source.config().path("batchApproved").asBoolean(false))
      throw new CollectorFailure(403, "BATCH_NOT_APPROVED");
    return core.post("/candidates", key, Json.tree(Map.of("collectorId", core.collectorId(), "originUrl", url, "discoveryMode", discoveryMode)));
  }
}
