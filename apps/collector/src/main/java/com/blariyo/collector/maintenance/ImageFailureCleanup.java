package com.blariyo.collector.maintenance;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.storage.RetentionObjects;
import java.util.*;
import java.util.function.Consumer;

/** Exact discarded item/run prefixes; idempotent after crash and independent of expiry. */
public final class ImageFailureCleanup {
  public record Result(int completed,int failed) {}
  private final RetentionRepository repository;
  private final RetentionObjects objects;
  private final Consumer<String> alert;
  public ImageFailureCleanup(RetentionRepository repository,RetentionObjects objects,Consumer<String> alert) {
    this.repository=repository;this.objects=objects;this.alert=alert;
  }
  public Result once() {
    int completed=0,failed=0;
    for(var job:repository.imageCleanupPending()) {
      try {
        // Snapshot all pages before deletion; offset-based local pagination must not skip keys.
        var keys=new LinkedHashSet<String>();
        keys.add("collect/raw/"+job.run()+"/"+job.item()+".html");
        String prefix="collect/media/"+job.run()+"/"+job.item()+"/",token=null;
        var tokens=new HashSet<String>();
        do {
          var page=objects.list(prefix,token);keys.addAll(page.keys());token=page.nextToken();
          if(token!=null&&!tokens.add(token))throw new CollectorFailure(503,"OBJECT_INVENTORY_TOKEN_LOOP");
        }while(token!=null);
        for(String key:keys) {
          if(!repository.imageCleanupAllowed(job,key))throw new CollectorFailure(409,"IMAGE_CLEANUP_REFERENCE_PROTECTED");
          objects.delete(key);
          if(objects.exists(key))throw new CollectorFailure(503,"OBJECT_DELETE_NOT_CONFIRMED");
        }
        repository.finishImageCleanup(job);completed++;
      }catch(RuntimeException e) {
        failed++;alert.accept("BATCH_IMAGE_CLEANUP_FAILED");
      }
    }
    return new Result(completed,failed);
  }
}
