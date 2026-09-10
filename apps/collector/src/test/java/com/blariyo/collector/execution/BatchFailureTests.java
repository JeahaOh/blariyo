package com.blariyo.collector.execution;


import static org.junit.jupiter.api.Assertions.*;

import java.net.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;

class BatchFailureTests {
  @Test
  void lostOwnershipIsStoppedAndVersionUncertaintyRequiresReconciliation() {
    for (String code :
        List.of(
            "CORE_CANDIDATE_EXECUTION_CONFLICT",
            "CORE_CANDIDATE_NOT_FOUND",
            "CORE_CANDIDATE_LEASE_CONFLICT"))
      assertEquals("STOPPED", BatchRuntime.failureState(code));
    assertEquals(
        "RECONCILE_REQUIRED", BatchRuntime.failureState("CORE_CANDIDATE_VERSION_CONFLICT"));
    assertEquals("FAILED", BatchRuntime.failureState("CORE_UNAVAILABLE"));
  }
}
