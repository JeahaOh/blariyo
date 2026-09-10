package com.blariyo.collector.run;

import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

/** Every trigger enters the same validation, idempotency and FIFO queue boundary. */
@Service
public final class CollectorRunService {
  private final RunRepository runs;
  private final CollectorTelemetry telemetry;
  private final TransactionTemplate tx;

  public CollectorRunService(
      RunRepository runs, PlatformTransactionManager manager, CollectorTelemetry telemetry) {
    this.runs = runs;
    this.telemetry = telemetry;
    this.tx = new TransactionTemplate(manager);
  }

  public RunRepository.Submission submit(String trigger, String key, JsonNode body) {
    try {
      RunCommandValidation.validate(body);
      if (!Set.of("REST", "DISCORD", "QUARTZ").contains(trigger))
        throw new CollectorFailure(400, "TRIGGER_INVALID");
      if (!runs.ready()) throw new CollectorFailure(503, "COLLECTOR_NOT_READY");
      if (Boolean.TRUE.equals(
          runs.jdbc()
              .queryForObject(
                  "SELECT reconcile_required FROM collector.restore_gate", Boolean.class)))
        throw new CollectorFailure(503, "RESTORE_RECONCILE_REQUIRED");
      return runs.submit(trigger, key, body);
    } catch (RuntimeException failure) {
      telemetry.rejected(trigger);
      throw failure;
    }
  }

  public record DiscordSubmission(UUID id, boolean targetStored) {}

  public DiscordSubmission submitDiscord(
      String key, long candidate, UUID confirmation, UUID target) {
    return tx.execute(
        status -> {
          var submitted =
              submit(
                  "DISCORD", key, Json.tree(Map.of("mode", "COLLECT", "candidateId", candidate)));
          int inserted =
              runs.jdbc()
                  .update(
                      "INSERT INTO collector.notification(id,job_request_id,target_ref,event_code)"
                          + " VALUES(?,?,?,'COLLECTION_FINISHED') ON"
                          + " CONFLICT(job_request_id,event_code) DO NOTHING",
                      UUID.randomUUID(),
                      submitted.id(),
                      target);
          runs.jdbc()
              .update(
                  "UPDATE collector.confirmation SET job_request_id=? WHERE id=?",
                  submitted.id(),
                  confirmation);
          return new DiscordSubmission(submitted.id(), inserted == 1);
        });
  }
}
