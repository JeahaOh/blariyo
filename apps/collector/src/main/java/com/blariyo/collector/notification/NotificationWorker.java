package com.blariyo.collector.notification;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.discord.DiscordGateway;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.spool.EncryptedSpool;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** The notification outbox is independent of the collection Job outcome. */
@Component
public final class NotificationWorker {
  private final RunRepository runs;
  private final ObjectProvider<DiscordGateway> discord;
  private final CoreClient core;
  private final Secrets secrets;
  private final EncryptedSpool spool;
  private final CollectorTelemetry telemetry;

  public NotificationWorker(
      RunRepository runs,
      ObjectProvider<DiscordGateway> discord,
      CoreClient core,
      Secrets secrets,
      EncryptedSpool spool,
      CollectorTelemetry telemetry) {
    this.telemetry = telemetry;
    this.runs = runs;
    this.discord = discord;
    this.core = core;
    this.secrets = secrets;
    this.spool = spool;
  }

  static int delaySeconds(int attempts) {
    return switch (attempts) {
      case 1 -> 60;
      case 2 -> 300;
      default -> 900;
    };
  }

  @Scheduled(fixedDelayString = "${collector.notification-poll-ms:5000}")
  public void deliver() {
    if (!runs.mutationReady()) return;
    try {
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT"
                      + " n.id,n.job_request_id,n.target_ref,n.event_code,n.attempt_count,n.status,n.created_at,n.next_attempt_at,COALESCE(n.outcome,r.outcome)"
                      + " AS outcome,COALESCE(n.candidate_id,r.candidate_id) AS candidate_id FROM"
                      + " collector.notification n LEFT JOIN collector.run r ON"
                      + " r.id=n.job_request_id WHERE n.next_attempt_at<=now() AND n.status IN"
                      + " ('PENDING','FINAL_FAILED') AND (r.state IS NULL OR r.state NOT IN"
                      + " ('QUEUED','RUNNING','STOP_REQUESTED')) AND COALESCE(n.outcome,r.outcome)"
                      + " IS NOT NULL AND n.created_at>now()-interval '30 days' ORDER BY"
                      + " n.created_at LIMIT 10")) {
        UUID id = (UUID) row.get("id"), ref = (UUID) row.get("target_ref");
        if ("FINAL_FAILED".equals(row.get("status"))) {
          recordFailure(row);
          continue;
        }
        if (ref == null) {
          runs.jdbc().update("UPDATE collector.notification SET status='DELIVERED' WHERE id=?", id);
          continue;
        }
        int attempts = ((Number) row.get("attempt_count")).intValue() + 1;
        try {
          DiscordGateway gateway = discord.getIfAvailable();
          if (gateway == null) throw new CollectorFailure(503, "DISCORD_UNAVAILABLE");
          gateway.notify(ref, Objects.toString(row.get("outcome"), "UNKNOWN"));
          telemetry.notification("DELIVERED");
          runs.jdbc()
              .update(
                  "UPDATE collector.notification SET status='DELIVERED',attempt_count=? WHERE id=?",
                  attempts,
                  id);
          spool.delete(ref);
          runs.jdbc().update("UPDATE collector.notification SET target_ref=NULL WHERE id=?", id);
        } catch (Exception failure) {
          telemetry.notification(attempts >= 4 ? "FINAL_FAILED" : "RETRY");
          runs.jdbc()
              .update(
                  "UPDATE collector.notification SET"
                      + " attempt_count=?,status=?,next_attempt_at=now()+(? * interval '1 second')"
                      + " WHERE id=?",
                  attempts,
                  attempts >= 4 ? "FINAL_FAILED" : "PENDING",
                  attempts >= 4 ? 0 : delaySeconds(attempts),
                  id);
          if (attempts >= 4) {
            spool.delete(ref);
            runs.jdbc().update("UPDATE collector.notification SET target_ref=NULL WHERE id=?", id);
          }
        }
      }
    } catch (Exception ignored) {
      System.err.println("COLLECTOR_NOTIFICATION_UNAVAILABLE");
    }
  }

  private void recordFailure(Map<String, Object> row) {
    UUID id = (UUID) row.get("id");
    // Persist the retry boundary before transport; a restart never hammers a disconnected Core.
    runs.jdbc()
        .update(
            "UPDATE collector.notification SET next_attempt_at=now()+interval '1 hour' WHERE id=?",
            id);
    var body = new LinkedHashMap<String, Object>();
    body.put("collectorId", core.collectorId());
    body.put("deliveryId", id.toString());
    body.put("jobRequestId", row.get("job_request_id").toString());
    body.put("candidateId", row.get("candidate_id"));
    body.put("eventCode", "NOTIFICATION_FINAL_FAILED");
    body.put("severity", "WARN");
    body.put("occurredAt", ((java.sql.Timestamp) row.get("created_at")).toInstant().toString());
    body.put("attemptCount", 4);
    core.post("/operational-events", secrets.hmac("notification:" + id), Json.tree(body));
    runs.jdbc().update("UPDATE collector.notification SET status='CORE_RECORDED' WHERE id=?", id);
    if (row.get("target_ref") != null) {
      spool.delete((UUID) row.get("target_ref"));
      runs.jdbc().update("UPDATE collector.notification SET target_ref=NULL WHERE id=?", id);
    }
  }
}
