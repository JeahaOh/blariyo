package com.blariyo.collector.spool;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;

class SpoolTests {
  @TempDir Path directory;

  @BeforeEach
  void resolveTemporaryDirectory() throws Exception {
    directory = directory.toRealPath();
  }

  Secrets secrets() throws Exception {
    byte[] key = new byte[32];
    new java.security.SecureRandom().nextBytes(key);
    Path file = directory.resolve("secrets.json");
    Files.write(
        file,
        Json.bytes(
            Map.of(
                "spool-key",
                Base64.getEncoder().encodeToString(key),
                "request-key",
                Base64.getEncoder().encodeToString(key))));
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
    var env = new MockEnvironment().withProperty("collector.fixture-secrets", file.toString());
    env.setActiveProfiles("fixture");
    return new Secrets(env);
  }

  @Test
  void encryptedSpoolAuthenticatesPayloadAndReference() throws Exception {
    var spool = new EncryptedSpool(directory.resolve("spool").toString(), secrets());
    byte[] payload = "private fixture title".getBytes();
    UUID ref = spool.put(payload);
    assertArrayEquals(payload, spool.get(ref));
    Path path = directory.resolve("spool").resolve(ref + ".enc");
    byte[] encoded = Files.readAllBytes(path);
    assertFalse(new String(encoded).contains("private fixture title"));
    assertEquals(PosixFilePermissions.fromString("rw-------"), Files.getPosixFilePermissions(path));
    encoded[encoded.length - 1] ^= 1;
    Files.write(path, encoded);
    assertThrows(CollectorFailure.class, () -> spool.get(ref));
    spool.delete(ref);
    assertFalse(Files.exists(path));
  }

  @Test
  void spoolRejectsWeakPermissionsAndSymlinks() throws Exception {
    var spool = new EncryptedSpool(directory.resolve("spool").toString(), secrets());
    UUID ref = spool.put(new byte[] {1, 2});
    Path path = directory.resolve("spool").resolve(ref + ".enc");
    Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-r--r--"));
    assertThrows(CollectorFailure.class, () -> spool.get(ref));
  }

  @Test
  void spoolRejectsLinkedAncestorAndWrongKey() throws Exception {
    var initial = secrets();
    var spool = new EncryptedSpool(directory.resolve("original").toString(), initial);
    var reference = spool.put(new byte[] {1, 2, 3});
    secrets();
    assertThrows(CollectorFailure.class, () -> spool.get(reference));
    Files.createSymbolicLink(directory.resolve("linked"), directory.resolve("original"));
    assertThrows(
        CollectorFailure.class,
        () ->
            new EncryptedSpool(directory.resolve("linked/nested").toString(), initial)
                .put(new byte[] {1}));
  }
}
