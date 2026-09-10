package com.blariyo.collector.notification;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public final class OperationalEventOutbox {
  private final RunRepository runs;
  private final CoreClient core;
  private final Secrets secrets;

  public OperationalEventOutbox(RunRepository runs, CoreClient core, Secrets secrets) {
    this.runs = runs;
    this.core = core;
    this.secrets = secrets;
  }

  public void enqueue(String code) {
    if (!Set.of("SPOOL_CLEANUP_FAILED", "COLLECTOR_CLOCK_UNSAFE", "RECONCILE_REQUIRED")
        .contains(code)) throw new IllegalArgumentException();
    runs.jdbc()
        .update(
            "INSERT INTO collector.operational_event(id,event_key,event_code) VALUES(?,?,?) ON"
                + " CONFLICT(event_key) DO NOTHING",
            UUID.randomUUID(),
            code + ":" + LocalDate.now(ZoneOffset.UTC),
            code);
  }

  @Scheduled(fixedDelay = 5000)
  public void deliver() {
    if (!runs.mutationReady()) return;
    try {
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT * FROM collector.operational_event WHERE delivered_at IS NULL AND"
                      + " next_attempt_at<=now() AND occurred_at>now()-interval '30 days' ORDER BY"
                      + " occurred_at LIMIT 10")) {
        UUID id = (UUID) row.get("id");
        runs.jdbc()
            .update(
                "UPDATE collector.operational_event SET"
                    + " attempt_count=attempt_count+1,next_attempt_at=now()+interval '1 hour' WHERE"
                    + " id=?",
                id);
        var body = new LinkedHashMap<String, Object>();
        body.put("collectorId", core.collectorId());
        body.put("deliveryId", id.toString());
        body.put(
            "jobRequestId",
            row.get("job_request_id") == null ? null : row.get("job_request_id").toString());
        body.put("candidateId", row.get("candidate_id"));
        body.put("eventCode", row.get("event_code"));
        body.put("severity", row.get("severity"));
        body.put(
            "occurredAt", ((java.sql.Timestamp) row.get("occurred_at")).toInstant().toString());
        body.put("attemptCount", 1);
        try {
          core.post("/operational-events", secrets.hmac("event:" + id), Json.tree(body));
          runs.jdbc()
              .update("UPDATE collector.operational_event SET delivered_at=now() WHERE id=?", id);
        } catch (CollectorFailure ignored) {
        }
      }
      runs.jdbc()
          .update(
              "DELETE FROM collector.operational_event WHERE occurred_at<now()-interval '30 days'");
    } catch (Exception ignored) {
      System.err.println("COLLECTOR_EVENT_DELIVERY_UNAVAILABLE");
    }
  }
}
