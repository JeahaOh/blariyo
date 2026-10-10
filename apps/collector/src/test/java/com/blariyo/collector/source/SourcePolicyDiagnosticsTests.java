package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import java.util.*;
import org.junit.jupiter.api.Test;

class SourcePolicyDiagnosticsTests {
  @Test void eachPolicyGateHasItsOwnReasonAndKeepsTheExistingFailureCode() {
    var policy=new SourcePolicy("fixture.invalid",List.of("/allowed/"),"","","fixture contact");
    for(var entry:Map.of(
        "http://fixture.invalid/allowed/1","SCHEME_NOT_ALLOWED",
        "https://other.invalid/allowed/1","HOST_NOT_ALLOWED",
        "https://fixture.invalid/other/1","PATH_NOT_ALLOWED",
        "https://fixture.invalid:443/allowed/1","PORT_NOT_ALLOWED",
        "https://user:fixture-secret@fixture.invalid/allowed/1","URL_CREDENTIALS_NOT_ALLOWED",
        "https://fixture.invalid/allowed/1#fixture-secret","URL_FRAGMENT_NOT_ALLOWED").entrySet()) {
      var failure=assertThrows(CollectorFailure.class,()->policy.allow(entry.getKey()));
      assertEquals("SOURCE_NOT_ALLOWED",failure.getMessage());assertEquals(entry.getValue(),failure.details().get("diagnosticReason"));
      assertFalse(failure.details().toString().contains("fixture-secret"));
    }
  }
}
