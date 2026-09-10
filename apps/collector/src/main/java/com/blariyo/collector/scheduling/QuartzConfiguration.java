package com.blariyo.collector.scheduling;

import com.blariyo.collector.run.CollectorRunService;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.util.*;
import org.quartz.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.quartz.QuartzJobBean;

@Configuration
@ConditionalOnProperty(name = "collector.quartz-enabled", havingValue = "true")
public class QuartzConfiguration {
  @Bean
  JobDetail collectSweep() {
    return JobBuilder.newJob(Sweep.class).withIdentity("candidateSweep").storeDurably().build();
  }

  @Bean
  Trigger collectTrigger(JobDetail collectSweep) {
    return TriggerBuilder.newTrigger()
        .forJob(collectSweep)
        .withIdentity("candidateSweepTrigger")
        .withSchedule(
            CronScheduleBuilder.cronSchedule("0 0/15 * * * ?")
                .inTimeZone(TimeZone.getTimeZone("Asia/Seoul"))
                .withMisfireHandlingInstructionDoNothing())
        .build();
  }

  @Bean
  ApplicationRunner startQuartz(Scheduler scheduler, RunRepository runs) {
    return args -> {
      if (Boolean.TRUE.equals(
          runs.jdbc()
              .queryForObject(
                  "SELECT reconcile_required FROM collector.restore_gate", Boolean.class)))
        throw new CollectorFailure(503, "RESTORE_RECONCILE_REQUIRED");
      scheduler.start();
    };
  }

  @DisallowConcurrentExecution
  public static class Sweep extends QuartzJobBean {
    @Autowired CollectorRunService submissions;

    @Override
    protected void executeInternal(JobExecutionContext context) {
      submissions.submit(
          "QUARTZ",
          context.getTrigger().getKey() + ":" + context.getScheduledFireTime().getTime(),
          Json.tree(Map.of("mode", "COLLECT", "nextPending", true)));
    }
  }
}
