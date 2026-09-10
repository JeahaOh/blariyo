package com.blariyo.collector.maintenance;

import com.blariyo.collector.notification.OperationalEventOutbox;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.spool.EncryptedSpool;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public final class SpoolCleanup {
  private final RunRepository runs;
  private final EncryptedSpool spool;
  private final OperationalEventOutbox events;
  private final CollectorTelemetry telemetry;

  public SpoolCleanup(
      RunRepository runs,
      EncryptedSpool spool,
      OperationalEventOutbox events,
      CollectorTelemetry telemetry) {
    this.runs = runs;
    this.spool = spool;
    this.events = events;
    this.telemetry = telemetry;
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 60000)
  public void cleanup() {
    if (!runs.backgroundReady()) return;
    try {
      // Expiry is authoritative even if a stopped Job has not been resumed.
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT ref,job_request_id FROM collector.spool_reference WHERE"
                      + " expires_at<=now()")) {
        UUID ref = (UUID) row.get("ref"), job = (UUID) row.get("job_request_id");
        runs.jdbc()
            .update(
                "UPDATE collector.run SET"
                    + " state='RECONCILE_REQUIRED',restartable=false,outcome='SPOOL_EXPIRED' WHERE"
                    + " id=? AND state NOT IN"
                    + " ('RUNNING','STOP_REQUESTED','COMPLETED','COMPLETED_WITH_WARNINGS')",
                job);
        spool.delete(ref);
        telemetry.event("SPOOL", "EXPIRED");
        runs.jdbc()
            .update(
                "UPDATE collector.run SET spool_ref=NULL,spool_sha256=NULL WHERE spool_ref=?", ref);
        runs.jdbc().update("DELETE FROM collector.spool_reference WHERE ref=?", ref);
      }
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT id,spool_ref FROM collector.confirmation WHERE expires_at<=now()")) {
        spool.delete((UUID) row.get("spool_ref"));
        runs.jdbc().update("DELETE FROM collector.confirmation WHERE id=?", row.get("id"));
      }
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT id,target_ref FROM collector.notification WHERE"
                      + " created_at<=now()-interval '30 days'")) {
        if (row.get("target_ref") != null) spool.delete((UUID) row.get("target_ref"));
        runs.jdbc().update("DELETE FROM collector.notification WHERE id=?", row.get("id"));
      }
      Set<UUID> referenced = new HashSet<>();
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT ref FROM collector.spool_reference UNION SELECT spool_ref FROM"
                      + " collector.confirmation UNION SELECT target_ref FROM"
                      + " collector.notification WHERE target_ref IS NOT NULL"))
        referenced.add((UUID) row.get("ref"));
      // A one-hour grace protects files between atomic rename and metadata commit.
      spool.removeOrphans(referenced);
      telemetry.event("SPOOL_CLEANUP", "SUCCESS");
    } catch (Exception ignored) {
      telemetry.event("SPOOL_CLEANUP", "FAILED");
      System.err.println("SPOOL_CLEANUP_FAILED");
      try {
        events.enqueue("SPOOL_CLEANUP_FAILED");
      } catch (Exception unavailable) {
      }
    }
  }
}
