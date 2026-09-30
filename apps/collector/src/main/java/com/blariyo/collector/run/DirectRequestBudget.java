package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import java.sql.SQLException;
import java.util.Set;
import java.util.function.LongConsumer;
import java.util.function.LongSupplier;

/** Every attempt is charged before sending; unknown/failed permits never authorize HTTP. */
final class DirectRequestBudget {
  private final BatchStore store;
  private final String source;
  private final int limit;
  private final LongConsumer sleeper;
  private final LongSupplier nanoTime;

  DirectRequestBudget(BatchStore store,String source,int limit,LongConsumer sleeper) {
    this(store,source,limit,sleeper,System::nanoTime);
  }
  DirectRequestBudget(BatchStore store,String source,int limit,LongConsumer sleeper,LongSupplier nanoTime) {
    if(store==null)throw new CollectorFailure(503,"SOURCE_BUDGET_REQUIRED");
    if(limit<1||limit>1000000)throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    this.store=store;this.source=source;this.limit=limit;this.sleeper=sleeper;this.nanoTime=nanoTime;
  }
  void reserve(long interval) {
    reserve(interval,()->{});
  }
  void reserve(long interval,Runnable beforeSend) {
    for(;;) {
      if(Thread.currentThread().isInterrupted())throw new CollectorFailure(503,"BATCH_INTERRUPTED");
      long started=nanoTime.getAsLong(),wait,valid;
      try(var c=store.connection();var q=c.prepareStatement("SELECT wait_ms,valid_ms FROM collect.reserve_batch_request(?,?,?)")) {
        // A permit must be committed before HTTP, never held in the content transaction.
        if(!c.getAutoCommit())throw new CollectorFailure(503,"SOURCE_BUDGET_TRANSACTION_OPEN");
        q.setString(1,source);q.setInt(2,limit);q.setLong(3,interval);
        try(var row=q.executeQuery()) {
          if(!row.next())throw new CollectorFailure(503,"SOURCE_BUDGET_UNAVAILABLE");
          wait=row.getLong(1);valid=row.getLong(2);
        }
      } catch(SQLException error) {
        for(String code:Set.of("SOURCE_DAILY_LIMIT_EXCEEDED","SOURCE_CONFIG_REQUIRED","SOURCE_CLOCK_UNSAFE","SOURCE_RESTORE_RECONCILE_REQUIRED"))
          if(error.getMessage()!=null&&error.getMessage().contains(code))throw new CollectorFailure(code.equals("SOURCE_DAILY_LIMIT_EXCEEDED")?429:503,code);
        throw new CollectorFailure(503,"SOURCE_BUDGET_UNAVAILABLE");
      }
      if(wait>0){sleeper.accept(wait);continue;}
      beforeSend.run();
      long elapsed=nanoTime.getAsLong()-started;
      if(valid<=0||elapsed<0||elapsed>=valid*1_000_000L)
        throw new CollectorFailure(503,"SOURCE_PERMIT_EXPIRED");
      return;
    }
  }
}
