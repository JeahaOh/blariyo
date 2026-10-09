package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.*;
import java.net.URI;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.LongConsumer;

/** One bounded request policy shared by list, detail, redirect, image and file fetches. */
final class SourceRequests {
  private final SourceTransport transport;
  private final LongConsumer sleeper;
  private final long interval;
  private final Runnable beforeRequest;
  private final LongConsumer reservation;
  private final LongConsumer cooldown;
  private final java.util.function.Consumer<String> imageReservation;
  private final java.util.function.BiConsumer<String,Long> imageCooldown;
  SourceRequests(SourceTransport transport, LongConsumer sleeper, long interval) {
    this(transport,sleeper,interval,()->{});
  }
  SourceRequests(SourceTransport transport, LongConsumer sleeper, long interval,Runnable beforeRequest) {
    this(transport,sleeper,interval,beforeRequest,ignored->{},ignored->{},ignored->{},(host,delay)->{});
  }
  private SourceRequests(SourceTransport transport,LongConsumer sleeper,long interval,Runnable beforeRequest,LongConsumer reservation,LongConsumer cooldown,
      java.util.function.Consumer<String> imageReservation,java.util.function.BiConsumer<String,Long> imageCooldown) {
    this.transport=transport;this.sleeper=sleeper;this.interval=interval;
    this.beforeRequest=beforeRequest;this.reservation=reservation;this.cooldown=cooldown;
    this.imageReservation=imageReservation;this.imageCooldown=imageCooldown;
  }
  static SourceRequests controlled(SourceTransport transport,LongConsumer sleeper,long interval,SourceRegistry.Source source,BatchStore store,Runnable beforeRequest) {
    source.policy();
    var config=source.config();
    int dailyLimit=SourceRequestPolicy.dailyLimit(config);
    long minimum=SourceRequestPolicy.interval(config);
    if(!config.path("enabled").asBoolean(true))throw new CollectorFailure(403,"SOURCE_DISABLED");
    if(interval<minimum||interval>SourceRequestPolicy.MAX_INTERVAL_MS)
      throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    if(store==null)throw new CollectorFailure(503,"SOURCE_BUDGET_REQUIRED");
    Runnable guarded=()->{beforeRequest.run();store.assertCollectionEnabled(source.key());};
    guarded.run();
    return new SourceRequests(transport,sleeper,interval,guarded,
        delay->store.reserveRequest(source.key(),dailyLimit,delay,sleeper,guarded),
        delay->store.deferRequests(source.key(),delay),store::reserveImageHost,store::deferImageHost);
  }
  PinnedHttp.Response fetch(URI url,SourcePolicy policy,int maximum) {
    // robots.txt is operator reference data, not a preflight or an execution gate.
    URI current=url;
    var visited=new HashSet<URI>();
    for(int redirects=0;redirects<=3;redirects++) {
      policy.allow(current.toString());
      if(!visited.add(current.normalize()))throw new CollectorFailure(403,"SOURCE_REDIRECT_LOOP");
      var response=request(current,policy,maximum);
      if(response.status()==200)return response;
      if(response.status()>=300&&response.status()<400) {
        String location=header(response,"location");
        if(location.isBlank()||redirects==3)throw new CollectorFailure(403,"SOURCE_REDIRECT_BLOCKED");
        URI target;
        try {target=policy.allow(current.resolve(location).toString());}
        catch(IllegalArgumentException failure){throw new CollectorFailure(403,"SOURCE_REDIRECT_BLOCKED");}
        if(!policy.publicImage()&&!url.getHost().equalsIgnoreCase(target.getHost()))throw new CollectorFailure(403,"SOURCE_REDIRECT_BLOCKED");
        current=target;continue;
      }
      int status=response.status();
      if(status==404||status==410)throw new CollectorFailure(404,"SOURCE_GONE");
      if(status==401||status==403)throw new CollectorFailure(403,"SOURCE_ACCESS_BLOCKED");
      throw new CollectorFailure(422,"SOURCE_HTTP_REJECTED");
    }
    throw new CollectorFailure(403,"SOURCE_REDIRECT_LOOP");
  }
  private PinnedHttp.Response request(URI url,SourcePolicy policy,int maximum) {
    long delay=interval;
    for(int attempt=0;attempt<SourceRequestPolicy.MAX_HTTP_ATTEMPTS;attempt++) {
      if(Thread.currentThread().isInterrupted())throw new CollectorFailure(503,"BATCH_INTERRUPTED");
      if(delay>0)sleeper.accept(delay);
      beforeRequest.run();
      PinnedHttp.Response response;
      try {
        transport.validate(url);
        if(policy.publicImage())imageReservation.accept(url.getHost());
        reservation.accept(interval);
        response=transport.get(url,maximum,policy.userAgent());
      }
      catch(CollectorFailure failure) {
        if(!Set.of("SOURCE_FETCH_FAILED","SOURCE_DNS_FAILED").contains(failure.getMessage())||attempt==SourceRequestPolicy.MAX_HTTP_ATTEMPTS-1)throw failure;
        delay=Math.max(interval,1000L<<attempt);continue;
      }
      int status=response.status();
      if(status!=429&&status!=408&&status<500)return response;
      String code=status==429?"SOURCE_RATE_LIMITED":"SOURCE_HTTP_UNAVAILABLE";
      long retryAfter=retryAfter(response);
      // Persist the server deadline before ending this source, including across JVM restarts.
      if(status==429||attempt==SourceRequestPolicy.MAX_HTTP_ATTEMPTS-1||retryAfter>SourceRequestPolicy.MAX_INLINE_RETRY_WAIT_MS) {
        long wait=Math.max(interval,retryAfter>0?retryAfter:SourceRequestPolicy.DEFAULT_COOLDOWN_MS);
        if(policy.publicImage())imageCooldown.accept(url.getHost(),wait);
        else cooldown.accept(wait);
        throw new CollectorFailure(status==429?429:503,code);
      }
      delay=Math.max(Math.max(interval,1000L<<attempt),retryAfter);
    }
    throw new IllegalStateException("UNREACHABLE");
  }
  private static String header(PinnedHttp.Response response,String name) {
    return response.headers().entrySet().stream().filter(e->e.getKey().equalsIgnoreCase(name))
        .flatMap(e->e.getValue().stream()).findFirst().orElse("");
  }
  private static long retryAfter(PinnedHttp.Response response) {
    String value=header(response,"retry-after").trim();
    try {if(value.matches("[0-9]+"))return Math.multiplyExact(Long.parseLong(value),1000L);
      return Math.max(0,Duration.between(Instant.now(),ZonedDateTime.parse(value,DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()).toMillis());
    }catch(ArithmeticException | NumberFormatException e){return Long.MAX_VALUE;}catch(Exception ignored){return 0;}
  }
  static boolean stopSite(CollectorFailure failure) {
    return failure.status()==403||failure.status()==429||failure.status()==503;
  }
  static boolean imageFailure(String phase,Map<String,Object> detail,CollectorFailure failure) {
    String code=failure.getMessage();
    if(code.equals("IMAGE_URL_NOT_ALLOWED")||code.equals("IMAGE_PARSE_FAILED"))return true;
    return phase.equals("MEDIA")&&"IMAGE".equals(detail.get("assetKind"))&&Set.of(
        "SOURCE_NOT_ALLOWED","SOURCE_ACCESS_BLOCKED","SOURCE_REDIRECT_BLOCKED","SOURCE_REDIRECT_LOOP",
        "SOURCE_GONE","SOURCE_FETCH_FAILED","SOURCE_DNS_FAILED","SOURCE_HTTP_UNAVAILABLE","SOURCE_RATE_LIMITED",
        "IMAGE_HOST_DEFERRED","SOURCE_HTTP_REJECTED","SOURCE_NOT_IMAGE","SOURCE_ENCODING_UNSUPPORTED",
        "SOURCE_TOO_LARGE","SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED").contains(code);
  }
}
