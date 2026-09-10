package com.blariyo.collector.execution;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.PinnedHttp;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.SourceTransport;
import com.blariyo.collector.state.StateStore;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public final class CollectionPipeline {
  private final RunRepository runs;
  private final StateStore states;
  private final CoreClient core;
  private final Secrets secrets;
  private final String sourcesFile;
  private final SourceTransport http;
  private final CollectorTelemetry telemetry;

  public CollectionPipeline(
      RunRepository runs,
      StateStore states,
      CoreClient core,
      Secrets secrets,
      SourceTransport http,
      CollectorTelemetry telemetry,
      @Value("${collector.sources-file:}") String sourcesFile) {
    this.telemetry = telemetry;
    this.runs = runs;
    this.states = states;
    this.core = core;
    this.secrets = secrets;
    this.sourcesFile = sourcesFile;
    this.http = http;
  }

  public void step(int step, UUID id) {
    long start = System.nanoTime();
    boolean success = false;
    try {
      executeStep(step, id);
      success = true;
    } finally {
      telemetry.timedStep(step, System.nanoTime() - start, success);
    }
  }

  private void executeStep(int step, UUID id) {
    runs.checkStop(id);
    ObjectNode state = states.read(id);
    var run = runs.get(id);
    if (state.path("terminal").asBoolean(false)) return;
    if (step > 1 && state.has("claim")) {
      var current =
          core.get(
              "/candidates/"
                  + state.path("candidateId").asLong()
                  + "/execution-state?collectorExecutionId="
                  + run.get("collector_execution_id"));
      if (current.path("terminal").asBoolean(false)) {
        states.clear(id);
        state = Json.MAPPER.createObjectNode();
        state.put("terminal", true);
        states.save(id, state);
        return;
      }
    }
    switch (step) {
      case 0 -> {
        state.put("resolved", true);
        states.save(id, state);
      }
      case 1 -> claim(id, run, state);
      case 2 -> fetch(id, run, state);
      case 3 -> result(id, run, state);
      case 4 -> previews(id, run, state);
      case 5 -> {
        runs.jdbc()
            .update(
                "INSERT INTO collector.notification(id,job_request_id,event_code)"
                    + " VALUES(?,?,'COLLECTION_FINISHED') ON CONFLICT(job_request_id,event_code) DO"
                    + " NOTHING",
                UUID.randomUUID(),
                id);
        state.put("finished", true);
        states.save(id, state);
      }
      default -> throw new IllegalArgumentException();
    }
    telemetry.step(step);
  }

  private JsonNode mutation(UUID id, ObjectNode state, String name, String path, JsonNode body) {
    String key = secrets.hmac(id + ":" + name);
    if (!state.has("pending-" + name)) {
      state.set("pending-" + name, body.deepCopy());
      states.save(id, state);
    }
    if (name.equals("result"))
      runs.jdbc()
          .update(
              "UPDATE collector.run SET result_payload_sha256=? WHERE id=?",
              Json.sha(Json.canonical(state.get("pending-" + name))),
              id);
    var response = core.post(path, key, state.get("pending-" + name));
    state.set("response-" + name, response);
    states.save(id, state);
    return response;
  }

  private ObjectNode common(Map<String, Object> run, ObjectNode state) {
    var b = Json.MAPPER.createObjectNode();
    b.put("collectorId", core.collectorId());
    b.put("collectorExecutionId", run.get("collector_execution_id").toString());
    b.put("lockVersion", state.path("lockVersion").asInt());
    return b;
  }

  private void claim(UUID id, Map<String, Object> run, ObjectNode state) {
    if (state.has("claim")) return;
    var body = common(run, state);
    body.remove("lockVersion");
    body.put("mode", run.get("mode").toString());
    body.put("jobRequestId", id.toString());
    body.put("maxItems", 1);
    body.put("leaseSeconds", 180);
    if (run.get("candidate_id") != null)
      body.put("candidateId", ((Number) run.get("candidate_id")).longValue());
    if (run.get("initial_version") != null)
      body.put("lockVersion", ((Number) run.get("initial_version")).intValue());
    var response = mutation(id, state, "claim", "/candidates/claim", body);
    if (response.path("items").isEmpty()) {
      state.put("terminal", true);
      states.save(id, state);
      return;
    }
    var item = response.path("items").get(0);
    runs.jdbc()
        .update(
            "UPDATE collector.run SET candidate_id=?,next_pending=false WHERE id=?",
            item.path("candidateId").asLong(),
            id);
    state.set("claim", item);
    state.put("candidateId", item.path("candidateId").asLong());
    state.put("lockVersion", item.path("lockVersion").asInt());
    states.save(id, state);
  }

  private SourcePolicy policy(ObjectNode state) {
    try {
      var p =
          Json.parse(Files.readAllBytes(Path.of(sourcesFile)))
              .path(state.path("claim").path("sourceId").asText());
      if (!p.path("approved").asBoolean(false)
          || !p.path("host").asText().equals(state.path("claim").path("sourceHost").asText()))
        throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
      var prefixes = new ArrayList<String>();
      p.path("pathPrefixes").forEach(v -> prefixes.add(v.asText()));
      String userAgent = p.path("userAgent").asText();
      if (prefixes.isEmpty() || userAgent.isBlank() || !userAgent.contains("contact"))
        throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
      return new SourcePolicy(
          p.path("host").asText(),
          prefixes,
          p.path("titleSelector").asText(),
          p.path("imageSelector").asText(),
          userAgent);
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    }
  }

  private void heartbeat(UUID id, Map<String, Object> run, ObjectNode state) {
    if (run.get("mode").equals("PREVIEW_REFRESH") || state.has("resultSubmitted")) return;
    String name = "heartbeat-" + state.path("lockVersion").asInt();
    var body = common(run, state);
    body.put("leaseSeconds", 180);
    telemetry.heartbeat();
    var response =
        mutation(
            id,
            state,
            name,
            "/candidates/" + state.path("candidateId").asLong() + "/heartbeat",
            body);
    state.put("lockVersion", response.path("lockVersion").asInt());
    states.save(id, state);
  }

  private PinnedHttp.Response fetchOne(
      UUID id,
      Map<String, Object> run,
      ObjectNode state,
      SourcePolicy policy,
      URI first,
      String kind,
      int maximum,
      String name) {
    URI uri = first;
    for (int redirect = 0; redirect <= 3; redirect++) {
      runs.checkStop(id);
      policy.allow(uri.toString());
      http.validate(uri);
      String attempt = name + "-" + redirect;
      if (state.path("network-" + attempt).asBoolean(false))
        throw new CollectorFailure(409, "RECONCILE_REQUIRED");
      if (!state.has("pending-quota-" + attempt)) heartbeat(id, run, state);
      var body = common(run, state);
      body.put("jobRequestId", id.toString());
      body.put("candidateId", state.path("candidateId").asLong());
      body.put("requestKey", secrets.hmac(id + ":" + attempt));
      body.put("requestKind", redirect == 0 ? kind : "REDIRECT");
      runs.jdbc()
          .update(
              "INSERT INTO collector.network_attempt(id,job_request_id,request_key_hash,kind,state)"
                  + " VALUES(?,?,?, ?,'RESERVING') ON CONFLICT(request_key_hash) DO NOTHING",
              UUID.randomUUID(),
              id,
              secrets.hmac(id + ":" + attempt),
              redirect == 0 ? kind : "REDIRECT");
      long started = System.nanoTime();
      var reservation =
          mutation(
              id,
              state,
              "quota-" + attempt,
              "/sources/" + state.path("claim").path("sourceId").asLong() + "/request-reservations",
              body);
      telemetry.reservation(
          state.path("claim").path("sourceId").asLong(),
          redirect == 0 ? kind : "REDIRECT",
          reservation.path("remainingCount").asLong());
      long remaining =
          Duration.between(
                      Instant.parse(reservation.path("serverNow").asText()),
                      Instant.parse(reservation.path("validUntil").asText()))
                  .toMillis()
              - (System.nanoTime() - started) / 1_000_000;
      if (remaining < 500) throw new CollectorFailure(409, "COLLECTOR_CLOCK_UNSAFE");
      runs.jdbc()
          .update(
              "UPDATE collector.network_attempt SET"
                  + " reservation_id=?,valid_until=?::timestamptz,state='RESERVED' WHERE"
                  + " request_key_hash=?",
              UUID.fromString(reservation.path("reservationId").asText()),
              reservation.path("validUntil").asText(),
              secrets.hmac(id + ":" + attempt));
      runs.checkStop(id);
      runs.jdbc()
          .update(
              "UPDATE collector.network_attempt SET state='NETWORK_STARTED' WHERE"
                  + " request_key_hash=?",
              secrets.hmac(id + ":" + attempt));
      state.put("network-" + attempt, true);
      states.save(id, state);
      var response = http.get(uri, maximum, policy.userAgent());
      runs.jdbc()
          .update(
              "UPDATE collector.network_attempt SET state='COMPLETED' WHERE request_key_hash=?",
              secrets.hmac(id + ":" + attempt));
      if (response.status() >= 300 && response.status() < 400) {
        String location = response.headers().getOrDefault("location", List.of("")).getFirst();
        if (location.isBlank() || redirect == 3)
          throw new CollectorFailure(403, "SOURCE_REDIRECT_BLOCKED");
        uri = policy.allow(uri.resolve(location).toString());
        waitInterval(id, run, state);
        continue;
      }
      if (response.status() != 200)
        throw new CollectorFailure(
            response.status() == 403 || response.status() == 429 ? response.status() : 503,
            "SOURCE_HTTP_FAILED");
      return response;
    }
    throw new CollectorFailure(403, "SOURCE_REDIRECT_BLOCKED");
  }

  private void fetch(UUID id, Map<String, Object> run, ObjectNode state) {
    if (run.get("mode").equals("PREVIEW_REFRESH") || state.has("result")) return;
    try {
      var policy = policy(state);
      URI uri = policy.allow(state.path("claim").path("originUrl").asText());
      var robots =
          fetchOne(
              id,
              run,
              state,
              new SourcePolicy(
                  policy.host(),
                  List.of("/robots.txt"),
                  policy.titleSelector(),
                  policy.imageSelector(),
                  policy.userAgent()),
              URI.create("https://" + policy.host() + "/robots.txt"),
              "ROBOTS",
              512 * 1024,
              "robots");
      if (!policy.robotsAllows(new String(robots.bytes(), StandardCharsets.UTF_8), uri))
        throw new CollectorFailure(403, "ROBOTS_DISALLOWED");
      waitInterval(id, run, state);
      var response = fetchOne(id, run, state, policy, uri, "DETAIL", 2 * 1024 * 1024, "detail");
      if (!response.contentType().toLowerCase(Locale.ROOT).startsWith("text/html"))
        throw new CollectorFailure(415, "SOURCE_NOT_HTML");
      state.set("result", policy.extract(response.bytes(), uri));
      telemetry.event("FETCH_PARSE", "SUCCESS");
      states.save(id, state);
    } catch (CollectorFailure e) {
      if (e.getMessage().equals("RECONCILE_REQUIRED")
          || e.getMessage().equals("STOP_REQUESTED")
          || e.getMessage().startsWith("CORE_")) throw e;
      telemetry.event("FETCH_PARSE", "FAILED");
      state.set(
          "result",
          Json.tree(
              Map.of(
                  "status",
                  "FETCH_FAILED",
                  "fetchErrorCode",
                  e.getMessage(),
                  "warnings",
                  List.of())));
      states.save(id, state);
    }
  }

  private void waitInterval(UUID id, Map<String, Object> run, ObjectNode state) {
    // Quota permits include a ten-second send window; wait for the global next-request boundary.
    long wait = 10000 + state.path("claim").path("requestIntervalMs").asLong(1000);
    long end = System.nanoTime() + wait * 1_000_000,
        nextHeartbeat = System.nanoTime() + 30_000_000_000L;
    while (System.nanoTime() < end) {
      runs.checkStop(id);
      if (System.nanoTime() >= nextHeartbeat) {
        heartbeat(id, run, state);
        nextHeartbeat = System.nanoTime() + 30_000_000_000L;
      }
      try {
        Thread.sleep(Math.min(250, Math.max(1, (end - System.nanoTime()) / 1_000_000)));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new CollectorFailure(409, "STOP_REQUESTED");
      }
    }
  }

  private void result(UUID id, Map<String, Object> run, ObjectNode state) {
    if (run.get("mode").equals("PREVIEW_REFRESH") || state.has("resultSubmitted")) return;
    ObjectNode body = (ObjectNode) state.get("result").deepCopy();
    body.setAll(common(run, state));
    var response =
        mutation(
            id,
            state,
            "result",
            "/candidates/" + state.path("candidateId").asLong() + "/result",
            body);
    state.set("resultSubmitted", response);
    state.put("lockVersion", response.path("lockVersion").asInt());
    states.save(id, state);
  }

  private void previews(UUID id, Map<String, Object> run, ObjectNode state) {
    if (state.path("result").path("status").asText().equals("FETCH_FAILED")) return;
    var images =
        run.get("mode").equals("PREVIEW_REFRESH")
            ? state.path("claim").path("images")
            : state.path("resultSubmitted").path("imageCandidates");
    var policy = policy(state);
    for (var image : images) {
      String marker = "preview-" + image.path("candidateImageId").asLong();
      if (state.path(marker).asBoolean(false)) continue;
      String refName = marker + "-ref", mimeName = marker + "-mime";
      try {
        if (!state.has(refName)) {
          String remote = image.path("remoteUrl").asText();
          if (remote.isEmpty())
            remote =
                state
                    .path("result")
                    .path("imageCandidates")
                    .get(image.path("position").asInt() - 1)
                    .path("remoteUrl")
                    .asText();
          waitInterval(id, run, state);
          var response =
              fetchOne(
                  id, run, state, policy, policy.allow(remote), "IMAGE", 10 * 1024 * 1024, marker);
          String mime = response.contentType().split(";", 2)[0].strip();
          if (!Set.of("image/png", "image/jpeg", "image/webp", "image/gif").contains(mime))
            throw new CollectorFailure(415, "SOURCE_NOT_IMAGE");
          UUID ref = states.image(id, response.bytes());
          state.put(refName, ref.toString());
          state.put(mimeName, mime);
          states.save(id, state);
        }
        runs.checkStop(id);
        UUID ref = UUID.fromString(state.path(refName).asText());
        byte[] bytes = states.image(ref);
        var response =
            core.preview(
                "/candidates/"
                    + state.path("candidateId").asLong()
                    + "/images/"
                    + image.path("candidateImageId").asLong()
                    + "/preview",
                secrets.hmac(id + ":" + marker),
                run.get("collector_execution_id").toString(),
                state.path("lockVersion").asInt(),
                bytes,
                state.path(mimeName).asText());
        state.put("lockVersion", response.path("lockVersion").asInt());
        state.put(marker, true);
        states.save(id, state);
        states.discard(ref);
      } catch (CollectorFailure e) {
        // Source/image failures leave a successful candidate available for manual review.
        if (!Set.of(
                "SOURCE_NOT_ALLOWED",
                "SOURCE_HTTP_FAILED",
                "SOURCE_FETCH_FAILED",
                "SOURCE_NOT_IMAGE",
                "SOURCE_TOO_LARGE",
                "SOURCE_REDIRECT_BLOCKED",
                "SOURCE_ENCODING_UNSUPPORTED",
                "CORE_UNSUPPORTED_MEDIA_TYPE",
                "CORE_UPLOAD_TOO_LARGE")
            .contains(e.getMessage())) throw e;
        telemetry.event("PREVIEW", "SOURCE_FAILED");
        state.put("previewWarnings", true);
        state.put(marker, true);
        state.put(marker + "-failure", e.getMessage());
        states.save(id, state);
      }
    }
  }
}
