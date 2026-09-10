package com.blariyo.collector.web;

import com.blariyo.collector.maintenance.MetadataRetention;
import com.blariyo.collector.maintenance.SpoolCleanup;
import com.blariyo.collector.notification.NotificationWorker;
import com.blariyo.collector.run.CollectorRunService;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.spool.EncryptedSpool;
import com.blariyo.collector.state.StateStore;
import java.util.*;
import org.quartz.*;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("fixture")
public final class FixtureControls
    implements org.springframework.boot.ApplicationRunner, org.springframework.core.Ordered {
  public int getOrder() {
    return -1000;
  }

  public void run(org.springframework.boot.ApplicationArguments args) throws Exception {
    var key = new TriggerKey("candidateSweepTrigger");
    if (scheduler.getTrigger(key) != null) scheduler.pauseTrigger(key);
  }

  private final CollectorRunService submissions;
  private final RunRepository runs;
  private final Scheduler scheduler;
  private final EncryptedSpool spool;
  private final NotificationWorker notifications;
  private final SpoolCleanup spoolCleanup;
  private final MetadataRetention retention;
  private final StateStore states;

  public FixtureControls(
      CollectorRunService submissions,
      RunRepository runs,
      Scheduler scheduler,
      EncryptedSpool spool,
      NotificationWorker notifications,
      SpoolCleanup spoolCleanup,
      MetadataRetention retention,
      StateStore states) {
    this.states = states;
    this.submissions = submissions;
    this.runs = runs;
    this.scheduler = scheduler;
    this.spool = spool;
    this.notifications = notifications;
    this.spoolCleanup = spoolCleanup;
    this.retention = retention;
  }

  @PostMapping("/fixture/quartz/fire")
  Object fire() throws Exception {
    var key = new TriggerKey("candidateSweepTrigger");
    var trigger = (CronTrigger) scheduler.getTrigger(key);
    scheduler.pauseTrigger(key);
    scheduler.triggerJob(new JobKey("candidateSweep"));
    return LocalController.success(
        Map.of(
            "cron",
            trigger.getCronExpression(),
            "timezone",
            trigger.getTimeZone().getID(),
            "misfire",
            trigger.getMisfireInstruction()));
  }

  @PostMapping("/fixture/discord/{candidate}")
  Object discord(@PathVariable long candidate) {
    UUID confirmation = UUID.randomUUID(),
        input = spool.put(Json.bytes(Map.of("url", "https://fixture.invalid/post/confirmation")));
    runs.jdbc()
        .update(
            "INSERT INTO"
                + " collector.confirmation(id,actor_hmac,channel_hmac,spool_ref,trigger_key_hash)"
                + " VALUES(?,?,?,?,?)",
            confirmation,
            "a".repeat(64),
            "b".repeat(64),
            input,
            "c".repeat(64));
    String key = UUID.randomUUID().toString();
    var result =
        submissions.submitDiscord(
            key,
            candidate,
            confirmation,
            spool.put(Json.bytes(Map.of("channel", "fixture-channel"))));
    UUID duplicateTarget = spool.put(Json.bytes(Map.of("channel", "fixture-channel")));
    var replay = submissions.submitDiscord(key, candidate, confirmation, duplicateTarget);
    if (!replay.targetStored()) spool.delete(duplicateTarget);
    spool.delete(input);
    return LocalController.success(
        Map.of(
            "jobRequestId",
            result.id(),
            "replayId",
            replay.id(),
            "duplicateTargetStored",
            replay.targetStored()));
  }

  @PostMapping("/fixture/notifications/drain")
  Object drain() {
    notifications.deliver();
    return LocalController.success(Map.of("drained", true));
  }

  @PostMapping("/fixture/maintenance")
  Object clean() {
    spoolCleanup.cleanup();
    retention.cleanup();
    return LocalController.success(Map.of("cleaned", true));
  }

  @PostMapping("/fixture/spool/{id}")
  Object spool(@PathVariable UUID id) {
    UUID expired = states.image(id, "fixture image bytes".getBytes()),
        orphan = spool.put("fixture orphan bytes".getBytes());
    runs.jdbc()
        .update(
            "UPDATE collector.spool_reference SET expires_at=now()-interval '1 second' WHERE ref=?",
            expired);
    return LocalController.success(Map.of("expired", expired, "orphan", orphan));
  }
}
