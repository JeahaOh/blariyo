package com.blariyo.collector.storage;

import com.blariyo.collector.shared.CollectorFailure;
import java.util.List;
import java.util.Map;

/** Retention receives no upload or content/private/public object capability. */
public interface RetentionObjects {
  record Page(List<String> keys, String nextToken) {
    public Page { keys = List.copyOf(keys); }
  }
  Page list(String prefix, String token);
  void delete(String key);
  boolean exists(String key);

  static RetentionObjects fromEnvironment(Map<String,String> env) {
    String root = env.get("COLLECTOR_RETENTION_OBJECT_DIRECTORY");
    if (root != null && !root.isBlank()) return new BatchObjectStore.Local(root);
    // Deliberately no fallback to batch upload, API media or backup credentials.
    for (String field : List.of("ENDPOINT", "BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY")) {
      if (env.getOrDefault("COLLECTOR_RETENTION_S3_" + field, "").isBlank())
        throw new CollectorFailure(503, "RETENTION_OBJECT_CREDENTIALS_REQUIRED");
    }
    return new BatchObjectStore.S3Compatible(env.get("COLLECTOR_RETENTION_S3_ENDPOINT"),
        env.get("COLLECTOR_RETENTION_S3_BUCKET"), env.get("COLLECTOR_RETENTION_S3_ACCESS_KEY_ID"),
        env.get("COLLECTOR_RETENTION_S3_SECRET_ACCESS_KEY"));
  }
}
