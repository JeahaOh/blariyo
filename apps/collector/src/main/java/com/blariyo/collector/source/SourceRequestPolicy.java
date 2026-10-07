package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import tools.jackson.databind.JsonNode;

/** Shared defaults. A source's explicit JSON settings take precedence over defaults. */
public final class SourceRequestPolicy {
  public static final int DEFAULT_INTERVAL_MS = 5_000;
  public static final int DEFAULT_DAILY_LIMIT = 5_000;
  public static final int MIN_INTERVAL_MS = 1_000;
  public static final int MAX_INTERVAL_MS = 3_600_000;
  public static final int MAX_DAILY_LIMIT = 1_000_000;
  public static final int MAX_HTTP_ATTEMPTS = 3;
  public static final long MAX_INLINE_RETRY_WAIT_MS = 60_000;
  public static final long DEFAULT_COOLDOWN_MS = 900_000;

  private SourceRequestPolicy() {}

  public static int interval(JsonNode source) {
    return value(source,"requestIntervalMs",DEFAULT_INTERVAL_MS,MIN_INTERVAL_MS,MAX_INTERVAL_MS);
  }
  public static int dailyLimit(JsonNode source) {
    return value(source,"dailyRequestLimit",DEFAULT_DAILY_LIMIT,1,MAX_DAILY_LIMIT);
  }
  private static int value(JsonNode source,String key,int fallback,int minimum,int maximum) {
    var node=source.path(key);
    if(node.isMissingNode())return fallback;
    if(!node.isIntegralNumber()||!node.canConvertToInt()||node.asInt()<minimum||node.asInt()>maximum)
      throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    return node.asInt();
  }
}
