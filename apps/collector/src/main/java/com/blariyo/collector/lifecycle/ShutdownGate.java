package com.blariyo.collector.lifecycle;

import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public final class ShutdownGate {
  private final AtomicBoolean stopping = new AtomicBoolean();

  public boolean stopping() {
    return stopping.get();
  }

  @EventListener
  public void onClose(ContextClosedEvent event) {
    stopping.set(true);
  }
}
