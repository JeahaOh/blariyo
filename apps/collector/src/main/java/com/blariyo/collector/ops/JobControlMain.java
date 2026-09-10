package com.blariyo.collector.ops;

import com.blariyo.collector.CollectorApplication;
import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.execution.ExpiredRecovery;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.state.StateStore;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;

/** Explicit operator control. Its context never launches jobs, Quartz or notification delivery. */
public final class JobControlMain {
  public static void main(String[] args) {
    try {
      if (args.length < 2
          || args.length > 3
          || !Set.of("inspect", "resume", "reconcile", "release-restore").contains(args[0]))
        throw new IllegalArgumentException();
      String action = args[0], properties = args[args.length - 1];
      if (action.equals("release-restore") ? args.length != 2 : args.length != 3)
        throw new IllegalArgumentException();
      OperatorSettings.load(properties);
      var app = new SpringApplication(CollectorApplication.class);
      app.setWebApplicationType(WebApplicationType.NONE);
      try (var context =
          app.run(
              "--spring.config.additional-location=file:" + properties,
              "--collector.control-only=true",
              "--collector.processing-enabled=false",
              "--collector.quartz-enabled=false",
              "--collector.discord-enabled=false",
              "--spring.main.banner-mode=off")) {
        var runs = context.getBean(RunRepository.class);
        try (var lock = context.getBean(javax.sql.DataSource.class).getConnection();
            var statement = lock.createStatement()) {
          try (var result = statement.executeQuery("SELECT pg_try_advisory_lock(72189403)")) {
            result.next();
            if (!result.getBoolean(1)) throw new CollectorFailure(409, "WORKER_STILL_ACTIVE");
          }
          try {
            if (action.equals("release-restore")) {
              int pending =
                  runs.jdbc()
                      .queryForObject(
                          "SELECT count(*) FROM collector.run WHERE state IN"
                              + " ('QUEUED','RUNNING','STOP_REQUESTED','RECONCILE_REQUIRED')",
                          Integer.class);
              if (pending != 0) throw new CollectorFailure(409, "RESTORE_RECONCILE_REQUIRED");
              runs.jdbc().update("UPDATE collector.restore_gate SET reconcile_required=false");
              System.out.println("COLLECTOR_RESTORE_GATE_RELEASED");
              return;
            }
            UUID id = UUID.fromString(args[1]);
            var row = runs.get(id);
            if (action.equals("resume")) {
              if (Boolean.TRUE.equals(
                  runs.jdbc()
                      .queryForObject(
                          "SELECT reconcile_required FROM collector.restore_gate", Boolean.class)))
                throw new CollectorFailure(409, "RESTORE_RECONCILE_REQUIRED");
              if (!Set.of("FAILED", "STOPPED").contains(row.get("state"))
                  || !Boolean.TRUE.equals(row.get("restartable"))
                  || !((java.sql.Timestamp) row.get("expires_at"))
                      .toInstant()
                      .isAfter(Instant.now()))
                throw new CollectorFailure(409, "JOB_NOT_RESTARTABLE");
              var saved = context.getBean(StateStore.class).read(id);
              if (saved.has("claim") && row.get("candidate_id") != null) {
                var current =
                    context
                        .getBean(CoreClient.class)
                        .get(
                            "/candidates/"
                                + row.get("candidate_id")
                                + "/execution-state?collectorExecutionId="
                                + row.get("collector_execution_id"));
                if (current.path("terminal").asBoolean(false)
                    || !Set.of("RUNNING", "NEW").contains(current.path("status").asText()))
                  throw new CollectorFailure(409, "RECONCILE_REQUIRED");
              }
              int queued =
                  runs.jdbc()
                      .update(
                          "UPDATE collector.run SET state='QUEUED',queued_at=now(),finished_at=NULL"
                              + " WHERE id=? AND state IN ('FAILED','STOPPED') AND"
                              + " restartable=true",
                          id);
              if (queued != 1) throw new CollectorFailure(409, "JOB_NOT_RESTARTABLE");
            } else if (action.equals("reconcile")
                && !Set.of("COMPLETED", "COMPLETED_WITH_WARNINGS").contains(row.get("state"))) {
              if (Set.of("RUNNING", "STOP_REQUESTED").contains(row.get("state")))
                throw new CollectorFailure(409, "JOB_STILL_ACTIVE");
              context.getBean(ExpiredRecovery.class).reconcile(id);
            }
            System.out.println(Json.MAPPER.writeValueAsString(runs.publicState(id)));
          } finally {
            statement.execute("SELECT pg_advisory_unlock(72189403)");
          }
        }
      }
    } catch (CollectorFailure failure) {
      System.err.println(failure.getMessage());
      System.exit(1);
    } catch (Exception failure) {
      System.err.println("COLLECTOR_JOB_CONTROL_FAILED");
      System.exit(1);
    }
  }
}
