package com.blariyo.collector.source;

import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.file.*;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Stable source keys are independent from Core numeric IDs; ambiguity never picks the first match. */
public final class SourceRegistry {
  public record Source(String key, JsonNode config) {
    public SourcePolicy policy() { return SourcePolicy.from(config); }
    public SiteAdapter adapter() { return SiteAdapters.require(config.path("parser").asText()); }
    public String canonical(String url) {
      String canonical = SiteAdapters.supported(config.path("parser").asText())
          ? adapter().identify(URI.create(url)).canonical().toString() : url;
      policy().allow(canonical);
      return canonical;
    }
  }
  private final JsonNode config;
  public SourceRegistry(JsonNode config) {
    if (!config.isObject()) throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    this.config = config;
  }
  public static SourceRegistry read(String file) {
    try { return new SourceRegistry(Json.parse(Files.readAllBytes(Path.of(file)))); }
    catch (Exception e) { throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED"); }
  }
  public Source key(String key) {
    if (!config.has(key)) throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
    return new Source(key, config.get(key));
  }
  public Source host(String host, String coreId) {
    var matches = new ArrayList<Source>();
    for (var entry : config.properties()) {
      var value = entry.getValue();
      if (!value.path("host").asText().equalsIgnoreCase(host)) continue;
      if (coreId != null && value.hasNonNull("coreSourceId") && !value.path("coreSourceId").asText().equals(coreId))
        throw new CollectorFailure(403, "SOURCE_ID_MISMATCH");
      matches.add(new Source(entry.getKey(), value));
    }
    if (matches.size() != 1) throw new CollectorFailure(403, matches.isEmpty() ? "SOURCE_NOT_ALLOWED" : "SOURCE_CONFIG_AMBIGUOUS");
    return matches.getFirst();
  }
}
