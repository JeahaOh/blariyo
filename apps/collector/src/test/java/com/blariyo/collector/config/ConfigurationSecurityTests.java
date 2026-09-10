package com.blariyo.collector.config;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;

class ConfigurationSecurityTests {
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
  void fixtureSecretsCannotEnableProductionOrSupplyMissingMaterial() throws Exception {
    var configured = secrets();
    assertThrows(CollectorFailure.class, () -> configured.require("missing-account"));
    var production =
        new Secrets(
            new MockEnvironment()
                .withProperty(
                    "collector.fixture-secrets", directory.resolve("secrets.json").toString()));
    assertEquals(
        "FIXTURE_SECRET_FORBIDDEN",
        assertThrows(CollectorFailure.class, () -> production.require("spool-key")).getMessage());
    Files.writeString(directory.resolve("secrets.json"), "{\"spool-key\":\"invalid-base64\"}");
    assertEquals(
        "KEY_MATERIAL_INVALID",
        assertThrows(CollectorFailure.class, () -> configured.key("spool-key")).getMessage());
  }

  @Test
  void operatorPropertiesRejectSharedPermissionsAndPlaintextSecrets() throws Exception {
    Path file = directory.resolve("operator.properties");
    Files.writeString(file, "spring.datasource.username=collector\n");
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
    OperatorSettings.load(file.toString());
    assertEquals("collector", OperatorSettings.user());
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-r--r--"));
    assertThrows(IllegalArgumentException.class, () -> OperatorSettings.load(file.toString()));
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
    Files.writeString(file, "collector.core-token=fixture-forbidden\n");
    assertThrows(IllegalArgumentException.class, () -> OperatorSettings.load(file.toString()));
  }
}
