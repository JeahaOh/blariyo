package com.blariyo.collector.maintenance;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.storage.RetentionObjects;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/** Dedicated server-side worker; requires only the retention DB login and collect DELETE/list/head. */
public final class BatchRetentionWorker {
  public record Result(int purged,int failed) {}
  private final RetentionRepository repository;
  private final RetentionObjects objects;
  private final Consumer<String> alert;
  public BatchRetentionWorker(RetentionRepository repository,RetentionObjects objects,Consumer<String> alert) {
    this.repository=repository;this.objects=objects;this.alert=alert;
  }
  public Result once(boolean restoreInventory) {
    try(var fence=repository.restoreFence(restoreInventory)) { return guardedOnce(restoreInventory); }
  }
  private Result guardedOnce(boolean restoreInventory) {
    var images=new ImageFailureCleanup(repository,objects,alert).once();
    repository.metadata();
    // Inventory precedes cleanup so objects uploaded after PURGED reopen their durable manifest.
    for(String prefix:List.of("collect/raw/","collect/media/","collect/report/")) {
      inventory(prefix,key->repository.observe(key,restoreInventory));
    }
    int purged=images.completed(),failed=images.failed();
    for(int i=0;i<20;i++) {
      var lease=repository.claim();if(lease==null)break;
      if(purge(lease))purged++;else failed++;
    }
    repository.cleanup();
    return new Result(purged,failed);
  }
  private void inventory(String prefix,Consumer<String> accept) {
    String token=null;Set<String> seen=new HashSet<>();
    do {
      var page=objects.list(prefix,token);
      for(String key:page.keys())accept.accept(key);
      token=page.nextToken();
      if(token!=null && !seen.add(token))throw new CollectorFailure(503,"OBJECT_INVENTORY_TOKEN_LOOP");
    } while(token!=null);
  }
  private boolean purge(RetentionRepository.Lease lease) {
    var lost=new AtomicReference<RuntimeException>();
    var heartbeat=Executors.newSingleThreadScheduledExecutor();
    var future=heartbeat.scheduleAtFixedRate(()->{
      try { repository.heartbeat(lease); } catch(RuntimeException e) { lost.compareAndSet(null,e); }
    },30,30,TimeUnit.SECONDS);
    try {
      if(lease.run()!=null) {
        inventory("collect/raw/"+lease.run()+"/"+lease.item()+".",key->repository.inventory(lease,key));
        inventory("collect/media/"+lease.run()+"/"+lease.item()+"/",key->repository.inventory(lease,key));
      }
      for(String key:repository.objects(lease)) {
        if(lost.get()!=null)throw lost.get();
        repository.heartbeat(lease);
        try {
          objects.delete(key);
          if(objects.exists(key))throw new CollectorFailure(503,"OBJECT_DELETE_NOT_CONFIRMED");
          repository.result(lease,key,true,null);
        } catch(RuntimeException e) {
          String code=e instanceof CollectorFailure?e.getMessage():"OBJECT_DELETE_FAILED";
          if(!code.matches("[A-Z][A-Z0-9_]{1,79}"))code="OBJECT_DELETE_FAILED";
          repository.result(lease,key,false,code);
          throw e;
        }
      }
      if(lost.get()!=null)throw lost.get();
      repository.finish(lease);
      return true;
    } catch(RuntimeException e) {
      try { repository.fail(lease); } catch(RuntimeException ignored) { /* Late owner cannot change the new owner's lease. */ }
      String code=e instanceof CollectorFailure?e.getMessage():"RETENTION_FAILED";
      if(!code.matches("[A-Z][A-Z0-9_]{1,79}"))code="RETENTION_FAILED";
      alert.accept("BATCH_RETENTION_FAILED code="+code);
      return false;
    } finally {
      future.cancel(false);heartbeat.shutdownNow();
    }
  }
}
