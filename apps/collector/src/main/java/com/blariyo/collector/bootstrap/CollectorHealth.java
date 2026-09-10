package com.blariyo.collector.bootstrap;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.run.RunRepository;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("collectorLocal")
public final class CollectorHealth implements HealthIndicator {
  private final RunRepository runs;
  private final Secrets secrets;

  public CollectorHealth(RunRepository runs, Secrets secrets) {
    this.runs = runs;
    this.secrets = secrets;
  }

  @Override
  public Health health() {
    try {
      if (!runs.ready()
          || Boolean.TRUE.equals(
              runs.jdbc()
                  .queryForObject(
                      "SELECT reconcile_required FROM collector.restore_gate", Boolean.class)))
        return Health.outOfService().build();
      secrets.key("spool-key");
      secrets.key("request-key");
      return Health.up().build();
    } catch (Exception ignored) {
      return Health.down().build();
    }
  }
}
