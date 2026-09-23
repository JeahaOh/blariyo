package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import tools.jackson.databind.JsonNode;

/** Per-article budgets; a source may only lower the service-wide bounds. */
public record SourceMediaLimits(int maxImages, int maxFileBytes, int maxTotalBytes) {
  public static final SourceMediaLimits DEFAULT = new SourceMediaLimits(200, 30 * 1024 * 1024, 150 * 1024 * 1024);
  public SourceMediaLimits {
    if (maxImages < 1 || maxImages > 200 || maxFileBytes < 1 || maxFileBytes > 30 * 1024 * 1024
        || maxTotalBytes < 1 || maxTotalBytes > 150 * 1024 * 1024)
      throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
  }
  public static SourceMediaLimits from(JsonNode config) {
    if (config.isMissingNode()) return DEFAULT;
    if (!config.isObject()) throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    for (var property : config.properties())
      if (!java.util.Set.of("maxImages", "maxFileBytes", "maxTotalBytes").contains(property.getKey()))
        throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    return new SourceMediaLimits(value(config, "maxImages", DEFAULT.maxImages),
        value(config, "maxFileBytes", DEFAULT.maxFileBytes), value(config, "maxTotalBytes", DEFAULT.maxTotalBytes));
  }
  private static int value(JsonNode config, String key, int fallback) {
    var value = config.path(key);
    if (value.isMissingNode()) return fallback;
    if (!value.isIntegralNumber() || !value.canConvertToInt()) throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    return value.asInt();
  }
}
