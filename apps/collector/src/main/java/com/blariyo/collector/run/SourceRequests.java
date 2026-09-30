package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.*;
import java.net.URI;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.LongConsumer;
import java.nio.charset.StandardCharsets;

/** One bounded request policy shared by list, detail, redirect, image and file fetches. */
final class SourceRequests {
  private final SourceTransport transport;
  private final LongConsumer sleeper;
  private final long interval;
  private final Runnable beforeRequest;
  private final LongConsumer reservation;
  private final boolean checkRobots;
  private final Map<String,RobotsRules> robots=new HashMap<>();
  private long crawlDelay;
  SourceRequests(SourceTransport transport, LongConsumer sleeper, long interval) {
    this(transport,sleeper,interval,()->{});
  }
  SourceRequests(SourceTransport transport, LongConsumer sleeper, long interval,Runnable beforeRequest) {
    this(transport,sleeper,interval,beforeRequest,ignored->{},false);
  }
  private SourceRequests(SourceTransport transport,LongConsumer sleeper,long interval,Runnable beforeRequest,LongConsumer reservation,boolean checkRobots) {
    this.transport=transport;this.sleeper=sleeper;this.interval=interval;
    this.beforeRequest=beforeRequest;this.reservation=reservation;this.checkRobots=checkRobots;
  }
  static SourceRequests controlled(SourceTransport transport,LongConsumer sleeper,long interval,SourceRegistry.Source source,BatchStore store,Runnable beforeRequest) {
    source.policy();
    var config=source.config();var daily=config.path("dailyRequestLimit");var configured=config.path("requestIntervalMs");
    long minimum=configured.isMissingNode()?10000:configured.asLong(-1);
    if(!config.path("enabled").asBoolean(true))throw new CollectorFailure(403,"SOURCE_DISABLED");
    if(!daily.isIntegralNumber()||!daily.canConvertToInt()||daily.asInt()<1||daily.asInt()>1000000
        ||!configured.isMissingNode()&&!configured.isIntegralNumber()||minimum<10000||minimum>3600000
        ||interval<minimum||interval>3600000)throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    if(store==null)throw new CollectorFailure(503,"SOURCE_BUDGET_REQUIRED");
    return new SourceRequests(transport,sleeper,interval,beforeRequest,
        delay->store.reserveRequest(source.key(),daily.asInt(),delay,sleeper,beforeRequest),true);
  }
  PinnedHttp.Response fetch(URI url,SourcePolicy policy,int maximum) {
    return fetch(url,policy,maximum,false);
  }
  private PinnedHttp.Response fetch(URI url,SourcePolicy policy,int maximum,boolean robot) {
    URI current=url;
    var visited=new HashSet<URI>();
    for(int redirects=0;redirects<=3;redirects++) {
      policy.allow(current.toString());
      if(!visited.add(current.normalize()))throw new CollectorFailure(403,"SOURCE_REDIRECT_LOOP");
      if(checkRobots&&!robot)allowRobots(current,policy);
      var response=request(current,policy,maximum);
      if(response.status()==200)return response;
      if(response.status()>=300&&response.status()<400) {
        String location=header(response,"location");
        if(location.isBlank()||redirects==3)throw new CollectorFailure(403,"SOURCE_REDIRECT_BLOCKED");
        URI target;
        try {target=policy.allow(current.resolve(location).toString());}
        catch(IllegalArgumentException failure){throw new CollectorFailure(403,"SOURCE_REDIRECT_BLOCKED");}
        if(!url.getHost().equalsIgnoreCase(target.getHost()))throw new CollectorFailure(403,"SOURCE_REDIRECT_BLOCKED");
        current=target;continue;
      }
      int status=response.status();
      if(status==404||status==410)throw new CollectorFailure(404,"SOURCE_GONE");
      if(status==401||status==403)throw new CollectorFailure(403,"SOURCE_ACCESS_BLOCKED");
      throw new CollectorFailure(422,"SOURCE_HTTP_REJECTED");
    }
    throw new CollectorFailure(403,"SOURCE_REDIRECT_LOOP");
  }
  private void allowRobots(URI target,SourcePolicy policy) {
    String host=target.getHost().toLowerCase(Locale.ROOT);
    var rules=robots.get(host);
    if(rules==null) {
      var robotsPolicy=new SourcePolicy(host,List.of("/robots.txt"),"","",policy.userAgent());
      PinnedHttp.Response response;
      try{response=fetch(URI.create("https://"+host+"/robots.txt"),robotsPolicy,512*1024,true);}
      catch(CollectorFailure error) {
        if(Set.of("SOURCE_GONE","SOURCE_HTTP_REJECTED","SOURCE_ACCESS_BLOCKED","SOURCE_FETCH_FAILED",
            "SOURCE_DNS_FAILED","SOURCE_HTTP_UNAVAILABLE","SOURCE_REDIRECT_BLOCKED","SOURCE_REDIRECT_LOOP",
            "SOURCE_NOT_ALLOWED","SOURCE_TOO_LARGE").contains(error.getMessage()))
          throw new CollectorFailure(403,"ROBOTS_UNVERIFIED");
        throw error;
      }
      if(!response.contentType().toLowerCase(Locale.ROOT).startsWith("text/plain"))throw new CollectorFailure(403,"ROBOTS_UNVERIFIED");
      rules=new RobotsRules(new String(response.bytes(),StandardCharsets.UTF_8));
      if(!rules.valid())throw new CollectorFailure(403,"ROBOTS_UNVERIFIED");
      long delay=rules.delayMillis(policy.userAgent());
      if(delay>3600000)throw new CollectorFailure(403,"ROBOTS_DELAY_UNSUPPORTED");
      crawlDelay=Math.max(crawlDelay,delay);robots.put(host,rules);
    }
    if(!rules.allows(policy.userAgent(),target))throw new CollectorFailure(403,"ROBOTS_DISALLOWED");
  }
  private PinnedHttp.Response request(URI url,SourcePolicy policy,int maximum) {
    long delay=Math.max(interval,crawlDelay);
    for(int attempt=0;attempt<3;attempt++) {
      if(Thread.currentThread().isInterrupted())throw new CollectorFailure(503,"BATCH_INTERRUPTED");
      if(delay>0)sleeper.accept(delay);
      beforeRequest.run();
      PinnedHttp.Response response;
      try {
        transport.validate(url);
        reservation.accept(Math.max(interval,crawlDelay));
        response=transport.get(url,maximum,policy.userAgent());
      }
      catch(CollectorFailure failure) {
        if(!Set.of("SOURCE_FETCH_FAILED","SOURCE_DNS_FAILED").contains(failure.getMessage())||attempt==2)throw failure;
        delay=Math.max(Math.max(interval,crawlDelay),1000L<<attempt);continue;
      }
      int status=response.status();
      if(status!=429&&status!=408&&status<500)return response;
      String code=status==429?"SOURCE_RATE_LIMITED":"SOURCE_HTTP_UNAVAILABLE";
      long retryAfter=retryAfter(response);
      // A long server cooldown stops this site; never cap it and retry too early.
      if(attempt==2||retryAfter>60000)throw new CollectorFailure(status==429?429:503,code);
      delay=Math.max(Math.max(Math.max(interval,crawlDelay),1000L<<attempt),retryAfter);
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
