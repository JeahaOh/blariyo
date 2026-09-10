package com.blariyo.collector.run;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.lifecycle.ShutdownGate;
import com.blariyo.collector.observability.CollectorTelemetry;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

@Repository
public class RunRepository {
  private volatile boolean initialized;
  private final boolean controlOnly;

  public boolean backgroundReady() {
    return ready() && !controlOnly;
  }

  public boolean mutationReady() {
    if (!backgroundReady()) return false;
    try {
      return !Boolean.TRUE.equals(
          jdbc.queryForObject(
              "SELECT reconcile_required FROM collector.restore_gate", Boolean.class));
    } catch (Exception e) {
      return false;
    }
  }

  public boolean ready() {
    return initialized && !shutdown.stopping();
  }

  public void markReady() {
    initialized = true;
  }

  private final JdbcTemplate jdbc;

  public JdbcTemplate jdbc() {
    return jdbc;
  }

  private final TransactionTemplate tx;
  private final Secrets secrets;
  private final ShutdownGate shutdown;
  private final CollectorTelemetry telemetry;

  public RunRepository(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      Secrets secrets,
      ShutdownGate shutdown,
      CollectorTelemetry telemetry,
      @org.springframework.beans.factory.annotation.Value("${collector.control-only:false}")
          boolean controlOnly) {
    this.controlOnly = controlOnly;
    this.telemetry = telemetry;
    this.shutdown = shutdown;
    this.jdbc = jdbc;
    this.tx = new TransactionTemplate(manager);
    this.secrets = secrets;
  }

  public record Submission(UUID id, boolean deduplicated) {}

  public Submission submit(String trigger, String key, JsonNode body) {
    String dedup = secrets.hmac(trigger + ":" + key), hash = Json.sha(Json.canonical(body));
    var submission =
        tx.execute(
            status -> {
              jdbc.queryForObject(
                  "SELECT pg_advisory_xact_lock(hashtextextended(?,0))", Object.class, dedup);
              var found =
                  jdbc.queryForList(
                      "SELECT id,request_hash FROM collector.run WHERE trigger_key_hash=?", dedup);
              if (!found.isEmpty()) {
                if (!hash.equals(found.getFirst().get("request_hash")))
                  throw new CollectorFailure(409, "IDEMPOTENCY_CONFLICT");
                return new Submission((UUID) found.getFirst().get("id"), true);
              }
              UUID id = UUID.randomUUID();
              jdbc.update(
                  "INSERT INTO"
                      + " collector.run(id,trigger,trigger_key_hash,request_hash,mode,candidate_id,initial_version,next_pending,state,collector_execution_id)"
                      + " VALUES(?,?,?,?,?,?,?,?,'QUEUED',?)",
                  id,
                  trigger,
                  dedup,
                  hash,
                  body.path("mode").asText(),
                  body.has("candidateId") ? body.get("candidateId").longValue() : null,
                  body.has("lockVersion") ? body.get("lockVersion").intValue() : null,
                  body.path("nextPending").asBoolean(false),
                  UUID.randomUUID());
              return new Submission(id, false);
            });
    telemetry.submitted(trigger, submission.deduplicated());
    return submission;
  }

  public Map<String, Object> get(UUID id) {
    var rows = jdbc.queryForList("SELECT * FROM collector.run WHERE id=?", id);
    if (rows.isEmpty()) throw new CollectorFailure(404, "JOB_NOT_FOUND");
    return rows.getFirst();
  }

  public Map<String, Object> publicState(UUID id) {
    var r = get(id);
    var result = new LinkedHashMap<String, Object>();
    result.put("jobRequestId", id);
    result.put("trigger", r.get("trigger"));
    result.put("state", r.get("state"));
    result.put("candidateId", r.get("candidate_id"));
    result.put("outcome", Objects.requireNonNullElse(r.get("outcome"), "PENDING"));
    for (String key : List.of("created_at", "started_at", "finished_at"))
      result.put(
          switch (key) {
            case "created_at" -> "createdAt";
            case "started_at" -> "startedAt";
            default -> "finishedAt";
          },
          r.get(key) == null ? null : ((java.sql.Timestamp) r.get(key)).toInstant().toString());
    result.put("restartable", r.get("restartable"));
    result.put(
        "steps",
        r.get("batch_execution_id") == null
            ? List.of()
            : jdbc.queryForList(
                "SELECT step_name AS name,status FROM batch.batch_step_execution WHERE"
                    + " job_execution_id=? ORDER BY step_execution_id",
                r.get("batch_execution_id")));
    return result;
  }

  public UUID next() {
    return tx.execute(
        status -> {
          if (Boolean.TRUE.equals(
              jdbc.queryForObject(
                  "SELECT reconcile_required FROM collector.restore_gate", Boolean.class)))
            return null;
          if (!jdbc.queryForList(
                  "SELECT id FROM collector.run WHERE state IN ('RUNNING','STOP_REQUESTED')")
              .isEmpty()) return null;
          var rows =
              jdbc.queryForList(
                  "SELECT id FROM collector.run WHERE state='QUEUED' ORDER BY queued_at,id FOR"
                      + " UPDATE SKIP LOCKED LIMIT 1");
          if (rows.isEmpty()) return null;
          UUID id = (UUID) rows.getFirst().get("id");
          jdbc.update(
              "UPDATE collector.run SET state='RUNNING',started_at=COALESCE(started_at,now()) WHERE"
                  + " id=?",
              id);
          return id;
        });
  }

  public void finish(UUID id, String state, String outcome, boolean restartable) {
    var finished =
        tx.execute(
            status -> {
              var times =
                  jdbc.queryForMap(
                      "UPDATE collector.run SET state=?,outcome=?,restartable=?,finished_at=now()"
                          + " WHERE id=? RETURNING started_at,finished_at",
                      state,
                      outcome,
                      restartable,
                      id);
              jdbc.update(
                  "UPDATE collector.notification SET outcome=?,candidate_id=(SELECT candidate_id"
                      + " FROM collector.run WHERE id=?) WHERE job_request_id=?",
                  outcome,
                  id,
                  id);
              String eventCode =
                  state.equals("RECONCILE_REQUIRED")
                      ? "RECONCILE_REQUIRED"
                      : outcome.equals("COLLECTOR_CLOCK_UNSAFE")
                          ? "COLLECTOR_CLOCK_UNSAFE"
                          : outcome.equals("CORE_CANDIDATE_LEASE_CONFLICT")
                              ? "LEASE_EXPIRED"
                              : null;
              if (eventCode != null)
                jdbc.update(
                    "INSERT INTO"
                        + " collector.operational_event(id,event_key,event_code,job_request_id,candidate_id)"
                        + " SELECT ?,?,?,id,candidate_id FROM collector.run WHERE id=? ON"
                        + " CONFLICT(event_key) DO NOTHING",
                    UUID.randomUUID(),
                    eventCode + ":" + id,
                    eventCode,
                    id);
              return times;
            });

    org.slf4j.LoggerFactory.getLogger(RunRepository.class)
        .atInfo()
        .addKeyValue("jobRequestId", id)
        .addKeyValue("state", state)
        .addKeyValue("outcome", outcome)
        .log("COLLECTOR_JOB_FINISHED");
    telemetry.outcome(state);
    if (finished.get("started_at") instanceof java.sql.Timestamp start
        && finished.get("finished_at") instanceof java.sql.Timestamp end)
      telemetry.jobDuration(state, end.getTime() - start.getTime());
  }

  public void checkStop(UUID id) {
    if (shutdown.stopping()) throw new CollectorFailure(409, "STOP_REQUESTED");
    var r = get(id);
    if (!"RUNNING".equals(r.get("state"))) throw new CollectorFailure(409, "STOP_REQUESTED");
    if (((java.sql.Timestamp) r.get("expires_at")).toInstant().isBefore(Instant.now()))
      throw new CollectorFailure(409, "RECONCILE_REQUIRED");
  }

  public String stop(UUID id) {
    get(id);
    jdbc.update(
        "UPDATE collector.run SET state=CASE WHEN state='QUEUED' THEN 'STOPPED' WHEN"
            + " state='RUNNING' THEN 'STOP_REQUESTED' ELSE state END WHERE id=?",
        id);
    return get(id).get("state").toString();
  }

  public Map<String, Long> counts(int hours) {
    var map = new TreeMap<String, Long>();
    jdbc.queryForList(
            "SELECT state,count(*) AS count FROM collector.run WHERE created_at>=now()-(? *"
                + " interval '1 hour') GROUP BY state",
            hours)
        .forEach(r -> map.put(r.get("state").toString(), ((Number) r.get("count")).longValue()));
    return map;
  }

  public Map<String, Long> counts() {
    var map = new TreeMap<String, Long>();
    jdbc.queryForList("SELECT state,count(*) AS count FROM collector.run GROUP BY state")
        .forEach(r -> map.put(r.get("state").toString(), ((Number) r.get("count")).longValue()));
    return map;
  }
}
