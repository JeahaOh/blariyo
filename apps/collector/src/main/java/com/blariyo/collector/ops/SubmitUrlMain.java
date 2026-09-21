package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.config.PrivateFiles;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.Map;

/** Portable CLI for an already-running local collector, including docker compose exec. */
public final class SubmitUrlMain {
  public static void main(String[] args) {
    try {
      if (args.length != 2) throw new IllegalArgumentException();
      OperatorSettings.load(args[1]);
      Path file = Path.of(args[0]);
      PrivateFiles.check(file, false);
      if (Files.size(file) > 8192) throw new IllegalArgumentException();
      var input = Json.parse(Files.readAllBytes(file));
      String key = input.path("idempotencyKey").asText();
      if (!input.isObject() || input.size() != 2 || !input.path("originUrl").isString()
          || !key.matches("[A-Za-z0-9._:-]{1,128}")) throw new IllegalArgumentException();
      int port = Integer.parseInt(OperatorSettings.get("server.port", "COLLECTOR_LOCAL_PORT", "18787"));
      if (port < 1 || port > 65535) throw new IllegalArgumentException();
      var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/local/v1/candidates"))
          .timeout(Duration.ofSeconds(65)).header("Content-Type", "application/json")
          .header("Authorization", "Bearer " + OperatorSettings.secrets().require("local-run-token"))
          .header("Idempotency-Key", key)
          .POST(HttpRequest.BodyPublishers.ofByteArray(Json.bytes(Map.of("originUrl", input.path("originUrl").asText())))).build();
      var response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
          .followRedirects(HttpClient.Redirect.NEVER).build().send(request, HttpResponse.BodyHandlers.ofByteArray());
      if (response.statusCode() != 202) throw new IllegalStateException();
      var data = Json.parse(response.body()).path("data");
      System.out.println(Json.tree(Map.of("candidateId", data.path("candidateId").asLong(),
          "jobRequestId", java.util.UUID.fromString(data.path("jobRequestId").asText()).toString())));
    } catch (Exception e) {
      System.err.println("COLLECTOR_URL_SUBMISSION_FAILED");
      System.exit(1);
    }
  }
}
