package com.blariyo.collector.storage;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.jupiter.api.Test;

class BatchObjectStoreTests {
  @Test void apiCredentialsAreNeverBatchFallback() {
    var error=assertThrows(CollectorFailure.class,()->BatchObjectStore.fromEnvironment(java.util.Map.of(
        "R2_ENDPOINT","https://example.invalid","R2_PRIVATE_BUCKET","api-private",
        "R2_PRIVATE_ACCESS_KEY_ID","api-key","R2_PRIVATE_SECRET_ACCESS_KEY","api-secret")));
    assertEquals("BATCH_OBJECT_STORE_REQUIRED",error.getMessage());
    assertThrows(CollectorFailure.class,()->BatchObjectStore.fromEnvironment(java.util.Map.of(
        "COLLECTOR_OBJECT_STORE_S3_ENDPOINT","https://example.invalid","R2_PRIVATE_BUCKET","api-private",
        "R2_PRIVATE_ACCESS_KEY_ID","api-key","R2_PRIVATE_SECRET_ACCESS_KEY","api-secret")));
  }
  @Test
  void localStoreWritesOnlyCollectPrefixes() throws Exception {
    var root = Files.createTempDirectory("collector-object-store");
    var store = new BatchObjectStore.Local(root.toString());
    var record = store.put("collect/raw/run/item.html", "body".getBytes(StandardCharsets.UTF_8), "text/html");
    assertEquals("collect/raw/run/item.html", record.objectKey());
    assertEquals("body", Files.readString(root.resolve("collect/raw/run/item.html")));
    assertThrows(CollectorFailure.class, () -> store.put("../secret", new byte[] {1}, "application/octet-stream"));
    assertThrows(CollectorFailure.class, () -> store.put("collect/media/../../content/private/secret", new byte[] {1}, "image/png"));
  }

  @Test
  void s3CompatibleStoreRejectsIncompleteConfigAndInvalidKeysBeforeNetwork() {
    assertThrows(CollectorFailure.class, () -> new BatchObjectStore.S3Compatible("", "bucket", "access", "secret"));
    assertThrows(CollectorFailure.class, () -> new BatchObjectStore.S3Compatible("http://example.invalid", "bucket", "access", "secret"));
    var store = new BatchObjectStore.S3Compatible("https://example.invalid", "bucket", "access", "secret");
    assertThrows(CollectorFailure.class, () -> store.put("../secret", new byte[] {1}, "application/octet-stream"));
  }
}
