package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;

class RunCommandValidationTests {
  @Test
  void localRequestSchemaRejectsUrlAndInvalidModes() {
    RunCommandValidation.validate(Json.tree(Map.of("mode", "COLLECT", "nextPending", true)));
    for (var body :
        List.of(
            Map.of("mode", "COLLECT", "originUrl", "https://example.invalid"),
            Map.of("mode", "COLLECT", "candidateId", 1, "nextPending", true),
            Map.of("mode", "PREVIEW_REFRESH", "candidateId", 1),
            Map.of("mode", "COLLECT", "candidateId", -1)))
      assertThrows(CollectorFailure.class, () -> RunCommandValidation.validate(Json.tree(body)));
  }
}
