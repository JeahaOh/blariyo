package com.blariyo.collector.shared;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CollectorFailureTests {
  @Test void diagnosticsNeverIncludeCredentialsQueryFragmentOrRawMessages() {
    var failure=new CollectorFailure(403,"SOURCE_NOT_ALLOWED")
        .diagnostic("HOST_NOT_ALLOWED",URI.create("https://user:fixture-secret@CDN.example/x?token=fixture-secret#fixture-secret"),302);
    assertEquals(Map.of("diagnosticReason","HOST_NOT_ALLOWED","requestHost","cdn.example","httpStatus",302),failure.details());
    assertFalse(Json.tree(failure.details()).toString().contains("fixture-secret"));
    assertEquals("SOURCE_NOT_ALLOWED",failure.getMessage());assertEquals(403,failure.status());
    assertEquals(failure.details(),failure.diagnostic("PARSER_REJECTED",URI.create("https://other.invalid/"),200).details());
    assertTrue(new CollectorFailure(503,"SOURCE_FETCH_FAILED").diagnostic("raw error fixture-secret",null,999).details().isEmpty());
  }
}
