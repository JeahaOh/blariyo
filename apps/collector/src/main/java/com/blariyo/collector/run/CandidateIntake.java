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

  public JsonNode create(String key, String url) {
    if (url == null || url.isBlank() || url.length() > 2048)
      throw new CollectorFailure(400, "VALIDATION_FAILED");
    try {
      URI uri = URI.create(url);
      var config = Json.parse(Files.readAllBytes(Path.of(sourcesFile)));
      boolean allowed = false;
      for (var entry : config.properties()) {
        var source = entry.getValue();
        if (source.path("approved").asBoolean(false)
            && source.path("host").asText().equalsIgnoreCase(uri.getHost())) {
          SourcePolicy.from(source).allow(url);
          allowed = true;
          break;
        }
      }
      if (!allowed) throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
    } catch (CollectorFailure e) { throw e; }
    catch (IllegalArgumentException e) { throw new CollectorFailure(400, "VALIDATION_FAILED"); }
    catch (Exception e) { throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED"); }
    return core.post("/candidates", key, Json.tree(Map.of("collectorId", core.collectorId(), "originUrl", url)));
  }
}
