package com.blariyo.collector.observability;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

@Component
public final class CollectorTelemetry {
  private final MeterRegistry registry;
  private final ConcurrentMap<Long, AtomicLong> budgets = new ConcurrentHashMap<>();

  public CollectorTelemetry(MeterRegistry registry) {
    this.registry = registry;
  }

  public void submitted(String trigger, boolean duplicate) {
    registry
        .counter(
            "collector.jobs.submitted",
            "trigger",
            trigger,
            "deduplicated",
            Boolean.toString(duplicate))
        .increment();
  }

  public void step(int step) {
    registry.counter("collector.steps.completed", "step", Integer.toString(step)).increment();
  }

  public void reservation(long source, String kind, long remaining) {
    registry.counter("collector.reservations", "kind", kind).increment();
    budgets
        .computeIfAbsent(
            source,
            id -> {
              var value = new AtomicLong();
              Gauge.builder("collector.quota.remaining", value, AtomicLong::doubleValue)
                  .tag("source", id.toString())
                  .register(registry);
              return value;
            })
        .set(remaining);
  }

  public void rateLimited(long source) {
    registry.counter("collector.quota.rate.limited", "source", Long.toString(source)).increment();
  }

  public void heartbeat() {
    registry.counter("collector.heartbeats").increment();
  }

  public void outcome(String state) {
    registry.counter("collector.jobs.finished", "state", state).increment();
  }

  public void notification(String status) {
    registry.counter("collector.notifications", "status", status).increment();
  }

  public void rejected(String trigger) {
    registry
        .counter(
            "collector.jobs.rejected",
            "trigger",
            java.util.Set.of("REST", "DISCORD", "QUARTZ").contains(trigger) ? trigger : "UNKNOWN")
        .increment();
  }

  public void timedStep(int step, long nanos, boolean success) {
    registry
        .timer(
            "collector.step.duration",
            "step",
            Integer.toString(step),
            "outcome",
            success ? "SUCCESS" : "FAILED")
        .record(nanos, TimeUnit.NANOSECONDS);
  }

  public void jobDuration(String state, long milliseconds) {
    registry
        .timer("collector.job.duration", "state", state)
        .record(Math.max(0, milliseconds), TimeUnit.MILLISECONDS);
  }

  public void event(String operation, String outcome) {
    registry
        .counter("collector.operations", "operation", operation, "outcome", outcome)
        .increment();
  }
}
