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
  SourceRequests(SourceTransport transport, LongConsumer sleeper, long interval) {
    this.transport=transport;this.sleeper=sleeper;this.interval=interval;
  }
  PinnedHttp.Response fetch(URI url,SourcePolicy policy,int maximum) {
    URI current=url;
    for(int redirects=0;redirects<5;redirects++) {
      policy.allow(current.toString());
      var response=request(current,policy,maximum);
      if(response.status()==200)return response;
      if(response.status()>=300&&response.status()<400) {
        String location=header(response,"location");
        if(!location.isBlank()) {current=policy.allow(current.resolve(location).toString());continue;}
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
    for(int attempt=0;attempt<3;attempt++) {
      if(Thread.currentThread().isInterrupted())throw new CollectorFailure(503,"BATCH_INTERRUPTED");
      if(delay>0)sleeper.accept(delay);
      PinnedHttp.Response response;
      try {transport.validate(url);response=transport.get(url,maximum,policy.userAgent());}
      catch(CollectorFailure failure) {
        if(!Set.of("SOURCE_FETCH_FAILED","SOURCE_DNS_FAILED").contains(failure.getMessage())||attempt==2)throw failure;
        delay=Math.max(interval,1000L<<attempt);continue;
      }
      int status=response.status();
      if(status!=429&&status!=408&&status<500)return response;
      String code=status==429?"SOURCE_RATE_LIMITED":"SOURCE_HTTP_UNAVAILABLE";
      long retryAfter=retryAfter(response);
      // A long server cooldown stops this site; never cap it and retry too early.
      if(attempt==2||retryAfter>60000)throw new CollectorFailure(status==429?429:503,code);
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
}
