package com.blariyo.collector.web;

import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.discord.DiscordGateway;
import com.blariyo.collector.run.CollectorRunService;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import java.time.Instant;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
public class LocalController {
  private final RunRepository repository;
  private final CoreClient core;
  private final CollectorRunService submissions;
  private final org.springframework.beans.factory.ObjectProvider<DiscordGateway> discord;
  private final boolean discordEnabled;

  public LocalController(
      RunRepository repository,
      CoreClient core,
      CollectorRunService submissions,
      org.springframework.beans.factory.ObjectProvider<DiscordGateway> discord,
      org.springframework.core.env.Environment env) {
    this.repository = repository;
    this.core = core;
    this.submissions = submissions;
    this.discord = discord;
    this.discordEnabled = env.getProperty("collector.discord-enabled", Boolean.class, false);
  }

  static Map<String, Object> success(Object data) {
    return Map.of(
        "data",
        data,
        "meta",
        Map.of("requestId", UUID.randomUUID(), "timestamp", Instant.now().toString()));
  }

  @PostMapping("/local/v1/jobs/collect")
  ResponseEntity<?> submit(
      @RequestHeader("Idempotency-Key") String key, @RequestBody JsonNode body) {
    var submitted = submissions.submit("REST", key, body);
    UUID id = submitted.id();
    return ResponseEntity.accepted()
        .body(
            success(
                Map.of(
                    "jobRequestId",
                    id,
                    "state",
                    "QUEUED",
                    "deduplicated",
                    submitted.deduplicated())));
  }

  @GetMapping("/local/v1/jobs/{id}")
  Object get(@PathVariable UUID id) {
    return success(repository.publicState(id));
  }

  @PostMapping("/local/v1/jobs/{id}/stop")
  ResponseEntity<?> stop(@PathVariable UUID id) {
    return ResponseEntity.accepted().body(success(Map.of("state", repository.stop(id))));
  }

  @GetMapping("/local/v1/status")
  Object status(@RequestParam(defaultValue = "24") int windowHours) {
    if (windowHours < 1 || windowHours > 168) throw new CollectorFailure(400, "VALIDATION_FAILED");
    var result = new LinkedHashMap<String, Object>();
    result.put("asOf", Instant.now().toString());
    result.put("local", repository.counts(windowHours));
    try {
      result.put("core", core.get("/status?windowHours=" + windowHours));
      result.put("partial", false);
    } catch (CollectorFailure e) {
      result.put("partial", true);
      result.put("core", Map.of("status", "UNAVAILABLE"));
    }
    var gateway = discord.getIfAvailable();
    boolean connected = gateway != null && gateway.connected();
    result.put("discord", Map.of("enabled", discordEnabled, "connected", connected));
    result.put(
        "reconcileRequired",
        Boolean.TRUE.equals(
            repository
                .jdbc()
                .queryForObject(
                    "SELECT reconcile_required FROM collector.restore_gate", Boolean.class)));
    if (discordEnabled && !connected) result.put("partial", true);
    result.put(
        "dependencies", Map.of("localDatabase", Map.of("ready", true), "core", core.observation()));
    return success(result);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> failure(Exception e) {
    int status =
        e instanceof CollectorFailure f
            ? f.status()
            : e
                        instanceof
                        org.springframework.web.method.annotation
                            .MethodArgumentTypeMismatchException
                    || e instanceof IllegalArgumentException
                    || e
                        instanceof
                        org.springframework.http.converter.HttpMessageNotReadableException
                ? 400
                : 503;
    String code =
        e instanceof CollectorFailure
            ? e.getMessage()
            : status == 400 ? "VALIDATION_FAILED" : "DEPENDENCY_UNAVAILABLE";
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "error",
                Map.of("code", code, "message", "요청을 처리하지 못했습니다.", "details", Map.of()),
                "meta",
                Map.of("requestId", UUID.randomUUID(), "timestamp", Instant.now().toString())));
  }
}
