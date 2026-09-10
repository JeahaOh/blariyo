package com.blariyo.collector;

import java.nio.file.*;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.listener.StepExecutionListener;
import org.springframework.batch.core.step.*;
import org.springframework.batch.core.step.StepExecution;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;

@Configuration
@Profile("fixture")
public class FixtureStepCrash {
  @Bean
  static BeanPostProcessor crashAtStepBoundary(Environment env) {
    return new BeanPostProcessor() {
      public Object postProcessAfterInitialization(Object bean, String name) {
        String wanted = env.getProperty("collector.fixture-crash-step");
        if (wanted != null && bean instanceof ListableStepLocator locator) {
          for (String stepName : locator.getStepNames()) {
            if (!stepName.equals(wanted)) continue;
            ((AbstractStep) locator.getStep(stepName))
                .registerStepExecutionListener(
                    new StepExecutionListener() {
                      private void boundary(String phase) {
                        if (!phase.equals(env.getProperty("collector.fixture-crash-phase"))) return;
                        try {
                          Files.writeString(
                              Path.of(env.getRequiredProperty("collector.fixture-crash-marker")),
                              stepName + ":" + phase,
                              StandardOpenOption.CREATE_NEW);
                          Thread.sleep(60000);
                          throw new IllegalStateException("FIXTURE_KILL_NOT_RECEIVED");
                        } catch (InterruptedException e) {
                          Thread.currentThread().interrupt();
                          throw new IllegalStateException("FIXTURE_INTERRUPTED");
                        } catch (java.io.IOException e) {
                          throw new IllegalStateException("FIXTURE_MARKER_FAILED");
                        }
                      }

                      public void beforeStep(StepExecution execution) {
                        boundary("before");
                      }

                      public ExitStatus afterStep(StepExecution execution) {
                        boundary("after");
                        return null;
                      }
                    });
          }
        }
        return bean;
      }
    };
  }
}
