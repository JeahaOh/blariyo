package com.blariyo.collector.execution;

import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.state.StateStore;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * After replay/spool expiry, only authoritative readback may settle a Job. No mutation is retried.
 */
@Component
public final class ExpiredRecovery {
  private final RunRepository runs;
  private final CoreClient core;
  private final StateStore states;
  private final CollectorTelemetry telemetry;

  public ExpiredRecovery(
      RunRepository runs, CoreClient core, StateStore states, CollectorTelemetry telemetry) {
    this.runs = runs;
    this.core = core;
    this.states = states;
    this.telemetry = telemetry;
  }

  public boolean settle(UUID id) {
    var run = runs.get(id);
    if (((java.sql.Timestamp) run.get("expires_at")).toInstant().isAfter(Instant.now()))
      return false;
    return reconcile(id);
  }

  public boolean reconcile(UUID id) {
    var run = runs.get(id);
    String state = "RECONCILE_REQUIRED", outcome = "REPLAY_EXPIRED";
    try {
      if (run.get("candidate_id") != null) {
        var current =
            core.get(
                "/candidates/"
                    + run.get("candidate_id")
                    + "/execution-state?collectorExecutionId="
                    + run.get("collector_execution_id"));
        if (current.path("terminal").asBoolean(false)) {
          state = "STOPPED";
          outcome = "CANDIDATE_TERMINAL";
        } else if (run.get("result_payload_sha256") != null
            && run.get("result_payload_sha256").equals(current.path("resultPayloadSha256").asText())
            && Set.of("NEW", "FETCH_FAILED").contains(current.path("status").asText())) {
          state =
              current.path("status").asText().equals("NEW")
                  ? "COMPLETED_WITH_WARNINGS"
                  : "COMPLETED";
          outcome = "RESULT_DIGEST_RECONCILED";
        } else if (current.path("status").asText().equals("FETCH_FAILED")) {
          state = "STOPPED";
          outcome = "CORE_FETCH_FAILED";
        }
      }
    } catch (CollectorFailure failure) {
      if (failure.getMessage().equals("CORE_CANDIDATE_EXECUTION_CONFLICT")
          || failure.getMessage().equals("CORE_CANDIDATE_NOT_FOUND")) {
        state = "STOPPED";
        outcome = "CANDIDATE_SUPERSEDED";
      }
    }
    telemetry.event("RECONCILIATION", state);
    runs.finish(id, state, outcome, false);
    states.clear(id);
    return true;
  }
}
