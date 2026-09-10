package com.blariyo.collector.bootstrap;

import com.blariyo.collector.discord.DiscordGateway;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.spool.EncryptedSpool;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public final class CollectorMetrics {
  private final RunRepository runs;
  private final EncryptedSpool spool;
  private final ObjectProvider<DiscordGateway> discord;
  private final Map<String, AtomicLong> counts = new HashMap<>();
  private final AtomicLong restartable = new AtomicLong();
  private final AtomicLong databaseReady = new AtomicLong(),
      spoolReady = new AtomicLong(),
      spoolBytes = new AtomicLong(),
      spoolFiles = new AtomicLong(),
      discordConnected = new AtomicLong();

  public CollectorMetrics(
      RunRepository runs,
      EncryptedSpool spool,
      ObjectProvider<DiscordGateway> discord,
      MeterRegistry registry) {
    Gauge.builder("collector.jobs.restartable", restartable, AtomicLong::doubleValue)
        .register(registry);
    this.runs = runs;
    this.spool = spool;
    this.discord = discord;
    for (String state :
        List.of(
            "QUEUED",
            "RUNNING",
            "STOP_REQUESTED",
            "STOPPED",
            "COMPLETED",
            "COMPLETED_WITH_WARNINGS",
            "FAILED",
            "RECONCILE_REQUIRED")) {
      var value = new AtomicLong();
      counts.put(state, value);
      Gauge.builder("collector.jobs", value, AtomicLong::doubleValue)
          .tag("state", state)
          .register(registry);
    }
    Gauge.builder("collector.database.ready", databaseReady, AtomicLong::doubleValue)
        .register(registry);
    Gauge.builder("collector.spool.ready", spoolReady, AtomicLong::doubleValue).register(registry);
    Gauge.builder("collector.spool.bytes", spoolBytes, AtomicLong::doubleValue).register(registry);
    Gauge.builder("collector.spool.files", spoolFiles, AtomicLong::doubleValue).register(registry);
    Gauge.builder("collector.discord.connected", discordConnected, AtomicLong::doubleValue)
        .register(registry);
  }

  @Scheduled(fixedDelay = 5000)
  public void sample() {
    if (!runs.backgroundReady()) return;
    try {
      var snapshot = runs.counts();
      counts.forEach((key, value) -> value.set(snapshot.getOrDefault(key, 0L)));
      restartable.set(
          runs.jdbc()
              .queryForObject(
                  "SELECT count(*) FROM collector.run WHERE restartable=true AND state IN"
                      + " ('FAILED','STOPPED')",
                  Long.class));
      databaseReady.set(1);
    } catch (Exception ignored) {
      databaseReady.set(0);
    }
    try {
      long[] stats = spool.stats();
      spoolFiles.set(stats[0]);
      spoolBytes.set(stats[1]);
      spoolReady.set(1);
    } catch (Exception ignored) {
      spoolReady.set(0);
    }
    var gateway = discord.getIfAvailable();
    discordConnected.set(gateway != null && gateway.connected() ? 1 : 0);
  }
}
