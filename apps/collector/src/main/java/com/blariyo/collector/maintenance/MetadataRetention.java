package com.blariyo.collector.maintenance;

import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.state.StateStore;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public final class MetadataRetention {
  private final RunRepository runs;
  private final StateStore states;
  private final TransactionTemplate tx;

  public MetadataRetention(
      RunRepository runs, StateStore states, PlatformTransactionManager manager) {
    this.runs = runs;
    this.states = states;
    this.tx = new TransactionTemplate(manager);
  }

  @Scheduled(fixedDelay = 3600000, initialDelay = 60000)
  public void cleanup() {
    if (!runs.backgroundReady()) return;
    try {
      for (var row :
          runs.jdbc()
              .queryForList(
                  "SELECT id FROM collector.run WHERE created_at<now()-interval '14 days' AND state"
                      + " NOT IN ('RUNNING','STOP_REQUESTED') LIMIT 100")) {
        UUID id = (UUID) row.get("id");
        tx.executeWithoutResult(
            status -> {
              var db = runs.jdbc();
              var locked =
                  db.queryForList(
                      "SELECT batch_execution_id FROM collector.run WHERE id=? AND state NOT IN"
                          + " ('RUNNING','STOP_REQUESTED') FOR UPDATE",
                      id);
              if (locked.isEmpty()) return;
              states.clear(id);
              db.update(
                  "INSERT INTO collector.daily_summary(summary_date,trigger,state,job_count) SELECT"
                      + " (created_at AT TIME ZONE 'Asia/Seoul')::date,trigger,state,1 FROM"
                      + " collector.run WHERE id=? ON CONFLICT(summary_date,trigger,state) DO"
                      + " UPDATE SET job_count=collector.daily_summary.job_count+1",
                  id);
              Object execution = locked.getFirst().get("batch_execution_id");
              if (execution != null) {
                var instances =
                    db.queryForList(
                        "SELECT job_instance_id FROM batch.batch_job_execution WHERE"
                            + " job_execution_id=?",
                        execution);
                if (!instances.isEmpty()) {
                  Object instance = instances.getFirst().get("job_instance_id");
                  db.update(
                      "DELETE FROM batch.batch_step_execution_context WHERE step_execution_id IN"
                          + " (SELECT step_execution_id FROM batch.batch_step_execution WHERE"
                          + " job_execution_id IN (SELECT job_execution_id FROM"
                          + " batch.batch_job_execution WHERE job_instance_id=?))",
                      instance);
                  db.update(
                      "DELETE FROM batch.batch_step_execution WHERE job_execution_id IN (SELECT"
                          + " job_execution_id FROM batch.batch_job_execution WHERE"
                          + " job_instance_id=?)",
                      instance);
                  db.update(
                      "DELETE FROM batch.batch_job_execution_context WHERE job_execution_id IN"
                          + " (SELECT job_execution_id FROM batch.batch_job_execution WHERE"
                          + " job_instance_id=?)",
                      instance);
                  db.update(
                      "DELETE FROM batch.batch_job_execution_params WHERE job_execution_id IN"
                          + " (SELECT job_execution_id FROM batch.batch_job_execution WHERE"
                          + " job_instance_id=?)",
                      instance);
                  db.update(
                      "DELETE FROM batch.batch_job_execution WHERE job_instance_id=?", instance);
                  db.update(
                      "DELETE FROM batch.batch_job_instance WHERE job_instance_id=?", instance);
                }
              }
              db.update("DELETE FROM collector.network_attempt WHERE job_request_id=?", id);
              db.update("DELETE FROM collector.run WHERE id=?", id);
            });
      }
      runs.jdbc()
          .update(
              "DELETE FROM collector.daily_summary WHERE summary_date<(now() AT TIME ZONE"
                  + " 'Asia/Seoul')::date-30");
    } catch (Exception ignored) {
      System.err.println("COLLECTOR_METADATA_CLEANUP_FAILED");
    }
  }
}
