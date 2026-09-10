package com.blariyo.collector.core;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

@Component
public final class CoreClient {
  private final RestClient client;
  private final Secrets secrets;
  private final CollectorTelemetry telemetry;
  private final java.util.concurrent.atomic.AtomicLong
      lastSuccess = new java.util.concurrent.atomic.AtomicLong(),
      ready = new java.util.concurrent.atomic.AtomicLong();

  public CoreClient(
      @Value("${collector.core-origin}") String origin,
      Secrets secrets,
      CollectorTelemetry telemetry,
      io.micrometer.core.instrument.MeterRegistry registry) {
    this.telemetry = telemetry;
    io.micrometer.core.instrument.Gauge.builder(
            "collector.core.ready", ready, java.util.concurrent.atomic.AtomicLong::doubleValue)
        .register(registry);
    io.micrometer.core.instrument.Gauge.builder(
            "collector.core.last.success.epoch",
            lastSuccess,
            java.util.concurrent.atomic.AtomicLong::doubleValue)
        .register(registry);
    URI uri = URI.create(origin);
    if (uri.getUserInfo() != null
        || uri.getQuery() != null
        || uri.getFragment() != null
        || !List.of("", "/").contains(uri.getPath())
        || !("https".equals(uri.getScheme())
            || "http".equals(uri.getScheme())
                && List.of("127.0.0.1", "localhost", "[::1]").contains(uri.getHost())))
      throw new CollectorFailure(503, "CORE_ORIGIN_INVALID");
    var factory =
        new JdkClientHttpRequestFactory(
            HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build());
    factory.setReadTimeout(Duration.ofSeconds(60));
    this.client =
        RestClient.builder()
            .baseUrl(origin.replaceAll("/$", "") + "/api/collector/v1")
            .requestFactory(factory)
            .build();
    this.secrets = secrets;
  }

  public Map<String, Object> observation() {
    var data = new LinkedHashMap<String, Object>();
    data.put("ready", ready.get() == 1);
    data.put(
        "lastSuccessAt",
        lastSuccess.get() == 0
            ? null
            : java.time.Instant.ofEpochSecond(lastSuccess.get()).toString());
    return data;
  }

  public String collectorId() {
    String id = secrets.require("collector-id");
    if (!id.matches("collector-[a-z2-7]{16}"))
      throw new CollectorFailure(503, "COLLECTOR_ID_INVALID");
    return id;
  }

  public JsonNode get(String path) {
    return call(HttpMethod.GET, path, null, null, null);
  }

  public JsonNode post(String path, String key, JsonNode body) {
    return call(HttpMethod.POST, path, key, Json.canonical(body), null);
  }

  public JsonNode preview(
      String path, String key, String execution, int version, byte[] bytes, String mime) {
    var form = new LinkedMultiValueMap<String, Object>();
    form.add("collectorId", collectorId());
    form.add("collectorExecutionId", execution);
    form.add("lockVersion", String.valueOf(version));
    var headers = new HttpHeaders();
    headers.setContentType(MediaType.parseMediaType(mime));
    form.add(
        "file",
        new HttpEntity<>(
            new ByteArrayResource(bytes) {
              @Override
              public String getFilename() {
                return "preview";
              }
            },
            headers));
    return call(HttpMethod.POST, path, key, form, Json.sha(bytes));
  }

  private JsonNode call(HttpMethod method, String path, String key, Object body, String sha) {
    if (!path.startsWith("/") || path.startsWith("//") || path.contains(".."))
      throw new CollectorFailure(400, "CORE_PATH_INVALID");
    String operation =
        path.contains("/request-reservations")
            ? "RESERVATION"
            : path.endsWith("/claim")
                ? "CLAIM"
                : path.endsWith("/heartbeat")
                    ? "HEARTBEAT"
                    : path.endsWith("/result")
                        ? "RESULT"
                        : path.endsWith("/preview") ? "PREVIEW" : "READ_OR_EVENT";
    try {
      var request =
          client
              .method(method)
              .uri(path)
              .header("Authorization", "Bearer " + secrets.require("core-token"));
      if (key != null) request.header("Idempotency-Key", key);
      if (sha != null)
        request.header("X-Content-SHA256", sha).contentType(MediaType.MULTIPART_FORM_DATA);
      else request.contentType(MediaType.APPLICATION_JSON);
      if (body != null) request.body(body);
      var payload = Json.parse(request.retrieve().body(byte[].class));
      if (!payload.path("success").asBoolean(false) || !payload.has("data"))
        throw new CollectorFailure(503, "CORE_RESPONSE_INVALID");
      ready.set(1);
      lastSuccess.set(java.time.Instant.now().getEpochSecond());
      telemetry.event(operation, "SUCCESS");
      return payload.get("data");
    } catch (RestClientResponseException e) {
      ready.set(e.getStatusCode().is5xxServerError() ? 0 : 1);
      if (e.getStatusCode().value() == 429 && path.matches("/sources/[0-9]+/request-reservations"))
        telemetry.rateLimited(Long.parseLong(path.split("/")[2]));
      telemetry.event(
          operation,
          e.getStatusCode().value() == 429
              ? "RATE_LIMITED"
              : e.getStatusCode().value() == 409 ? "FENCED" : "FAILED");
      String code = "CORE_REQUEST_FAILED";
      try {
        String value =
            Json.parse(e.getResponseBodyAsByteArray()).path("error").path("code").asText();
        if (value.matches("[A-Z_]{1,60}")) code = value;
      } catch (Exception ignored) {
      }
      if (code.contains("LEASE")) telemetry.event("LEASE", "EXPIRED");
      throw new CollectorFailure(
          e.getStatusCode().value(), code.startsWith("CORE_") ? code : "CORE_" + code);
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      ready.set(0);
      telemetry.event(operation, "UNAVAILABLE");
      throw new CollectorFailure(503, "CORE_UNAVAILABLE");
    }
  }
}
