package com.blariyo.collector.core;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.net.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;

class CoreObservationTests {
  @TempDir Path directory;

  @Test
  void coreReadinessAndFailureMetricsContainNoRequestData() throws Exception {
    var file = directory.resolve("secret.json");
    Files.write(file, Json.bytes(Map.of("core-token", "fixture-token")));
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
    var env = new MockEnvironment().withProperty("collector.fixture-secrets", file.toString());
    env.setActiveProfiles("fixture");
    var status = new AtomicInteger(200);
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/",
        exchange -> {
          byte[] bytes =
              Json.bytes(
                  status.get() == 200
                      ? Map.of("success", true, "data", Map.of("count", 1))
                      : Map.of(
                          "error",
                          Map.of(
                              "code",
                              status.get() == 429
                                  ? "SOURCE_RATE_LIMITED"
                                  : "CANDIDATE_LEASE_CONFLICT")));
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(status.get(), bytes.length);
          exchange.getResponseBody().write(bytes);
          exchange.close();
        });
    server.start();
    var metrics = new SimpleMeterRegistry();
    try {
      var telemetry = new CollectorTelemetry(metrics);
      var client =
          new CoreClient(
              "http://127.0.0.1:" + server.getAddress().getPort(),
              new Secrets(env),
              telemetry,
              metrics);
      assertEquals(1, client.get("/status").path("count").asInt());
      assertEquals(1, metrics.get("collector.core.ready").gauge().value());
      status.set(429);
      assertEquals(
          429,
          assertThrows(
                  CollectorFailure.class,
                  () ->
                      client.post(
                          "/sources/1/request-reservations", "fixture", Json.tree(Map.of())))
              .status());
      assertEquals(
          1,
          metrics
              .get("collector.operations")
              .tags("operation", "RESERVATION", "outcome", "RATE_LIMITED")
              .counter()
              .count());
      status.set(409);
      assertThrows(
          CollectorFailure.class,
          () -> client.post("/candidates/1/heartbeat", "fixture", Json.tree(Map.of())));
      assertEquals(
          1,
          metrics
              .get("collector.operations")
              .tags("operation", "LEASE", "outcome", "EXPIRED")
              .counter()
              .count());
      status.set(503);
      assertThrows(CollectorFailure.class, () -> client.get("/status"));
      assertEquals(0, metrics.get("collector.core.ready").gauge().value());
      assertFalse(
          metrics.getMeters().stream()
              .map(m -> m.getId().toString())
              .anyMatch(
                  id ->
                      id.contains("fixture-token")
                          || id.contains("127.0.0.1")
                          || id.contains("/candidates")));
    } finally {
      metrics.close();
      server.stop(0);
    }
  }
}
