package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import java.util.Set;
import tools.jackson.databind.JsonNode;

public final class RunCommandValidation {
  private RunCommandValidation() {}

  public static void validate(JsonNode body) {
    if (!body.isObject()
        || body.properties().stream()
            .anyMatch(
                e ->
                    !Set.of("mode", "candidateId", "lockVersion", "nextPending")
                        .contains(e.getKey())))
      throw new CollectorFailure(400, "VALIDATION_FAILED");
    String mode = body.path("mode").asText();
    if (!Set.of("COLLECT", "PREVIEW_REFRESH").contains(mode))
      throw new CollectorFailure(400, "VALIDATION_FAILED");
    if (body.has("candidateId")
            && (!body.get("candidateId").isIntegralNumber()
                || !body.get("candidateId").canConvertToLong()
                || body.get("candidateId").longValue() < 1)
        || body.has("lockVersion")
            && (!body.get("lockVersion").isIntegralNumber()
                || !body.get("lockVersion").canConvertToInt()
                || body.get("lockVersion").longValue() < 1)
        || body.has("nextPending") && !body.get("nextPending").isBoolean())
      throw new CollectorFailure(400, "VALIDATION_FAILED");
    if (body.has("candidateId") == body.path("nextPending").asBoolean(false)
        || mode.equals("PREVIEW_REFRESH") && (!body.has("candidateId") || !body.has("lockVersion")))
      throw new CollectorFailure(400, "VALIDATION_FAILED");
  }
}
