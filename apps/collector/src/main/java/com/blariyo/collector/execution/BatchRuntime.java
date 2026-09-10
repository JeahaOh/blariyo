package com.blariyo.collector.execution;

import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.state.StateStore;
import java.sql.Connection;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.configuration.annotation.EnableJdbcJobRepository;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.JobExecution;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobOperator;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.Step;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.repeat.RepeatStatus;
import org.springframework.batch.infrastructure.support.transaction.ResourcelessTransactionManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.*;

@Configuration
@EnableScheduling
@EnableBatchProcessing
@EnableJdbcJobRepository(tablePrefix = "batch.BATCH_")
public class BatchRuntime {
  @Bean
  Job collectCandidateJob(
      JobRepository repository, CollectionPipeline pipeline, RunRepository runs) {
    String[] names = {
      "resolveCandidate",
      "claimCandidate",
      "fetchAndExtract",
      "submitResult",
      "uploadPreviews",
      "notifyAndFinalize"
    };
    Step[] steps = new Step[names.length];
    for (int i = 0; i < names.length; i++) {
      final int index = i;
      steps[i] =
          new StepBuilder(names[i], repository)
              .tasklet(
                  (contribution, context) -> {
                    String id =
                        context.getStepContext().getJobParameters().get("jobRequestId").toString();
                    pipeline.step(index, UUID.fromString(id));
                    return RepeatStatus.FINISHED;
                  },
                  new ResourcelessTransactionManager())
              .build();
    }
    var builder =
        new JobBuilder("collectCandidateJob", repository)
            .listener(
                new org.springframework.batch.core.listener.JobExecutionListener() {
                  public void beforeJob(JobExecution execution) {
                    runs.jdbc()
                        .update(
                            "UPDATE collector.run SET batch_execution_id=? WHERE id=?",
                            execution.getId(),
                            UUID.fromString(
                                execution.getJobParameters().getString("jobRequestId")));
                  }
                })
            .start(steps[0]);
    for (int i = 1; i < steps.length; i++) builder.next(steps[i]);
    return builder.build();
  }

  @Bean
  Dispatcher dispatcher(
      DataSource source,
      RunRepository runs,
      StateStore states,
      JobRepository repository,
      JobOperator operator,
      Job collectCandidateJob,
      ExpiredRecovery recovery,
      @Value("${collector.processing-enabled:false}") boolean enabled) {
    return new Dispatcher(
        source, runs, states, repository, operator, collectCandidateJob, recovery, enabled);
  }

  static String failureState(String outcome) {
    if (java.util.Set.of(
            "STOP_REQUESTED",
            "CORE_CANDIDATE_EXECUTION_CONFLICT",
            "CORE_CANDIDATE_NOT_FOUND",
            "CORE_CANDIDATE_LEASE_CONFLICT")
        .contains(outcome)) return "STOPPED";
    if (java.util.Set.of("RECONCILE_REQUIRED", "CORE_CANDIDATE_VERSION_CONFLICT").contains(outcome))
      return "RECONCILE_REQUIRED";
    return "FAILED";
  }

  static class Dispatcher {
    private final DataSource source;
    private final RunRepository runs;
    private final StateStore states;
    private final JobRepository repository;
    private final JobOperator operator;
    private final Job job;
    private final boolean enabled;
    private final ExpiredRecovery recovery;

    Dispatcher(
        DataSource source,
        RunRepository runs,
        StateStore states,
        JobRepository repository,
        JobOperator operator,
        Job job,
        ExpiredRecovery recovery,
        boolean enabled) {
      this.recovery = recovery;
      this.source = source;
      this.runs = runs;
      this.states = states;
      this.repository = repository;
      this.operator = operator;
      this.job = job;
      this.enabled = enabled;
    }

    @Scheduled(fixedDelay = 1000)
    public void dispatch() {
      if (!enabled || !runs.mutationReady()) return;
      try (Connection lock = source.getConnection();
          var sql = lock.createStatement()) {
        boolean held;
        try (var row = sql.executeQuery("SELECT pg_try_advisory_lock(72189403)")) {
          row.next();
          held = row.getBoolean(1);
        }
        if (!held) return;
        try {
          // The advisory lock proves there is no live local worker before recovering metadata.
          for (var row :
              runs.jdbc()
                  .queryForList(
                      "SELECT id FROM collector.run WHERE state IN ('RUNNING','STOP_REQUESTED')")) {
            UUID id = (UUID) row.get("id");
            var params =
                new JobParametersBuilder()
                    .addString("jobRequestId", id.toString())
                    .toJobParameters();
            var previous = repository.getLastJobExecution(job.getName(), params);
            if (previous != null && previous.isRunning()) {
              for (var step : previous.getStepExecutions())
                if (step.getStatus().isRunning()) {
                  step.setStatus(BatchStatus.STOPPED);
                  repository.update(step);
                }
              previous.setStatus(BatchStatus.STOPPED);
              repository.update(previous);
            }
            runs.jdbc()
                .update(
                    "UPDATE collector.run SET state=CASE WHEN state='STOP_REQUESTED' THEN 'STOPPED'"
                        + " ELSE 'QUEUED' END WHERE id=?",
                    id);
          }
          UUID id = runs.next();
          if (id == null) return;
          if (recovery.settle(id)) return;
          try {
            var params =
                new JobParametersBuilder()
                    .addString("jobRequestId", id.toString())
                    .toJobParameters();
            JobExecution previous = repository.getLastJobExecution(job.getName(), params);
            JobExecution execution =
                previous != null && previous.getStatus() == BatchStatus.COMPLETED
                    ? previous
                    : previous == null ? operator.start(job, params) : operator.restart(previous);
            runs.jdbc()
                .update(
                    "UPDATE collector.run SET batch_execution_id=? WHERE id=?",
                    execution.getId(),
                    id);
            if (execution.getStatus() == BatchStatus.COMPLETED) {
              var state = states.read(id);
              runs.finish(
                  id,
                  state.path("terminal").asBoolean(false)
                      ? "STOPPED"
                      : state.path("previewWarnings").asBoolean(false)
                          ? "COMPLETED_WITH_WARNINGS"
                          : "COMPLETED",
                  state.path("terminal").asBoolean(false)
                      ? "NO_ACTION"
                      : state.path("result").path("status").asText("SUCCESS"),
                  false);
              states.clear(id);
            } else {
              String outcome = "JOB_FAILED";
              for (Throwable failure : execution.getAllFailureExceptions())
                if (failure instanceof CollectorFailure) outcome = failure.getMessage();
              String status = failureState(outcome);
              boolean restartable = status.equals("FAILED") || outcome.equals("STOP_REQUESTED");
              runs.finish(id, status, outcome, restartable);
              if (status.equals("STOPPED") && !restartable) states.clear(id);
            }
          } catch (CollectorFailure e) {
            String status = failureState(e.getMessage());
            runs.finish(id, status, e.getMessage(), false);
            if (status.equals("STOPPED")) states.clear(id);
          } catch (Exception e) {
            runs.finish(id, "FAILED", "JOB_FAILED", true);
          }
        } finally {
          sql.execute("SELECT pg_advisory_unlock(72189403)");
        }
      } catch (Exception e) {
        System.err.println("COLLECTOR_DISPATCH_UNAVAILABLE");
      }
    }
  }
}
