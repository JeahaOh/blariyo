package com.blariyo.collector.discord;

import com.blariyo.collector.run.BatchQueueStore;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.*;
import java.net.URI;
import java.util.UUID;
import java.util.function.*;

/** Confirmation-only adapter; public URL validation makes no external requests. */
public final class BatchDiscordIntake {
  private final BatchQueueStore queue;
  private final Supplier<SourceRegistry> sources;
  private final Function<String,String> hmac;
  public BatchDiscordIntake(BatchQueueStore queue,Supplier<SourceRegistry> sources,Function<String,String> hmac){this.queue=queue;this.sources=sources;this.hmac=hmac;}
  public BatchQueueStore.Confirmation prepare(String interaction,String actor,String channel,String url) {
    try {
      var source=sources.get().host(URI.create(url).getHost(),null);
      String canonical=source.canonical(url);String key=source.adapter().identify(URI.create(canonical)).postKey();
      return queue.prepare(hmac.apply("interaction:"+interaction),hmac.apply("actor:"+actor),hmac.apply("channel:"+channel),source.key(),key,canonical);
    }catch(IllegalArgumentException e){throw new CollectorFailure(400,"VALIDATION_FAILED");}
  }
  public UUID confirm(UUID id,String actor,String channel) {
    String a=hmac.apply("actor:"+actor),c=hmac.apply("channel:"+channel);
    var confirmation=queue.confirmation(id,a,c);
    if(confirmation.requestId()!=null)return confirmation.requestId();
    // A source disabled after preparation cannot be confirmed; worker rechecks again.
    var source=sources.get().key(confirmation.source());
    if(!source.canonical(confirmation.url()).equals(confirmation.url())||!source.adapter().identify(URI.create(confirmation.url())).postKey().equals(confirmation.postKey()))
      throw new CollectorFailure(409,"SOURCE_IDENTITY_CHANGED");
    return queue.confirm(id,a,c);
  }
}
