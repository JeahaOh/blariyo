package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import java.util.*;
import java.util.function.*;

/** A source lock fences every queue claim, collection attempt and restart reconciliation. */
public final class BatchQueueWorker {
  public record Result(UUID requestId,UUID runId,String outcome) {}
  private final BatchStore store;
  private final BatchQueueStore queue;
  private final Supplier<SourceRegistry> sources;
  private final DirectUrlRunner runner;
  public BatchQueueWorker(BatchStore store,Supplier<SourceRegistry> sources,SourceTransport transport,BatchObjectStore objects) {
    this.store=store;this.queue=new BatchQueueStore(store);this.sources=sources;this.runner=new DirectUrlRunner(transport,store,objects);
  }
  BatchQueueWorker(BatchStore store,Supplier<SourceRegistry> sources,SourceTransport transport,BatchObjectStore objects,LongConsumer sleeper) {
    this.store=store;this.queue=new BatchQueueStore(store);this.sources=sources;this.runner=new DirectUrlRunner(transport,store,objects,sleeper);
  }
  public Result once() { return once(null); }
  public Result once(String sourceFilter) {
    for(String source:queue.readySources()) {
      if(sourceFilter!=null&&!sourceFilter.equals(source))continue;
      BatchStore.SourceLock lease;
      try{lease=store.lockSource(source);}catch(CollectorFailure e){if(e.getMessage().equals("BATCH_SOURCE_BUSY"))continue;throw e;}
      try(lease) {
        var request=queue.next(source);if(request==null)continue;
        if(request.state().equals("RUNNING")) {
          queue.settle(request.id());return new Result(request.id(),request.runId(),"RECOVERED");
        }
        // Load configuration before claim; unavailable configuration does not consume attempts.
        var registry=sources.get();SourceRegistry.Source policy;
        try{policy=registry.key(source);}catch(CollectorFailure e){
          if(!e.getMessage().equals("SOURCE_NOT_ALLOWED"))throw e;
          policy=new SourceRegistry.Source(source,Json.tree(Map.of("host",java.net.URI.create(request.url()).getHost(),"approved",false)));
        }
        request=queue.claim(request);UUID id=request.id();
        long interval=Math.max(10000,policy.config().path("requestIntervalMs").asLong(10000));
        var report=runner.runQueued(policy,new DirectUrlRunner.Options(source,request.url(),interval,true),run->queue.attach(id,run));
        queue.settle(id);
        return new Result(id,report.runId(),report.state());
      }
    }
    return new Result(null,null,"IDLE");
  }
}
