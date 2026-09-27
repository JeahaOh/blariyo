package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import java.net.URI;
import java.util.*;
import org.junit.jupiter.api.Test;

class SourceRequestsTests {
  private final URI url=URI.create("https://arca.live/b/live");
  private SourcePolicy policy() {return new SourceRegistry(Json.tree(Map.of("arcalive",Map.of(
      "host","arca.live","approved",true,"parser","ARCALIVE","pathPrefixes",List.of("/"),
      "userAgent","fixture contact.invalid","imageOrigins",Map.of())))).key("arcalive").policy();}
  private PinnedHttp.Response response(int status,Map<String,List<String>> headers) {
    return new PinnedHttp.Response(status,"text/html",headers,new byte[0]);
  }
  private SourceRegistry.Source controlledSource() {
    return TestSourceControls.registry(Json.tree(Map.of("arcalive",Map.of("host","arca.live","approved",true,
      "parser","ARCALIVE","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid")))).key("arcalive");
  }
  @Test void robotsDeniedOrUnverifiedNeverSendsTheTarget() {
    for(var robots:List.of(
      new PinnedHttp.Response(200,"text/plain",Map.of(),"User-agent: *\nDisallow: /b/".getBytes()),
      new PinnedHttp.Response(200,"text/html",Map.of(),"<html>challenge</html>".getBytes()),
      new PinnedHttp.Response(200,"text/plain",Map.of(),"User-agent: *\nCrawl-delay: NaN".getBytes()),
      new PinnedHttp.Response(404,"text/plain",Map.of(),new byte[0]))) {
      var transport=mock(SourceTransport.class);var store=mock(BatchStore.class);
      when(transport.get(any(),anyInt(),anyString())).thenReturn(robots);
      assertThrows(CollectorFailure.class,()->SourceRequests.controlled(transport,x->{},10000,controlledSource(),store,()->{}).fetch(url,policy(),100));
      verify(transport).get(eq(URI.create("https://arca.live/robots.txt")),eq(512*1024),anyString());
      verify(transport,never()).get(eq(url),anyInt(),anyString());
      verify(store).reserveRequest(eq("arcalive"),eq(1000000),eq(10000L),any(),any());
    }
  }
  @Test void robotsCrawlDelayRetryAndMediaUseOnePersistentSourceBudget() {
    var transport=mock(SourceTransport.class);var store=mock(BatchStore.class);var sleeps=new ArrayList<Long>();
    var requested=new ArrayList<URI>();var attempt=new java.util.concurrent.atomic.AtomicInteger();
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{
      URI target=call.getArgument(0);requested.add(target);
      if(target.getPath().equals("/robots.txt"))return new PinnedHttp.Response(200,"text/plain",Map.of(),"User-agent: *\nAllow: /\nCrawl-delay: 15".getBytes());
      return response(attempt.incrementAndGet()==1?503:200,Map.of());
    });
    var requests=SourceRequests.controlled(transport,sleeps::add,10000,controlledSource(),store,()->{});
    requests.fetch(url,policy(),100);
    var media=new SourcePolicy("cdn.fixture.invalid",List.of("/"),"","","fixture contact.invalid");
    requests.fetch(URI.create("https://cdn.fixture.invalid/image.png"),media,100);
    assertEquals(5,requested.size());assertEquals(List.of(10000L,15000L,15000L,15000L,15000L),sleeps);
    verify(store,times(5)).reserveRequest(eq("arcalive"),eq(1000000),anyLong(),any(),any());
    verify(store,times(4)).reserveRequest(eq("arcalive"),eq(1000000),eq(15000L),any(),any());
  }
  @Test void missingLimitAndBudgetOutageDenyAllContentRequests() {
    var transport=mock(SourceTransport.class);var store=mock(BatchStore.class);
    var config=(tools.jackson.databind.node.ObjectNode)controlledSource().config().deepCopy();config.remove("dailyRequestLimit");
    assertThrows(CollectorFailure.class,()->SourceRequests.controlled(transport,x->{},10000,new SourceRegistry.Source("arcalive",config),store,()->{}));
    verifyNoInteractions(transport,store);
    doThrow(new CollectorFailure(503,"SOURCE_BUDGET_UNAVAILABLE")).when(store).reserveRequest(anyString(),anyInt(),anyLong(),any(),any());
    assertThrows(CollectorFailure.class,()->SourceRequests.controlled(transport,x->{},10000,controlledSource(),store,()->{}).fetch(url,policy(),100));
    verify(transport,never()).get(any(),anyInt(),anyString());
  }
  @Test void zeroAndThreeRedirectsSucceedButFourthDestinationIsNeverRequested() {
    for(int hops:List.of(0,3,4)) {
      var transport=mock(SourceTransport.class);var sent=new ArrayList<URI>();
      when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{
        URI target=call.getArgument(0);sent.add(target);
        int hop=Integer.parseInt(target.getPath().substring(1));
        return hop<hops?response(302,Map.of("Location",List.of("/"+(hop+1)))):response(200,Map.of());
      });
      var requests=new SourceRequests(transport,ignored->{},0);
      URI start=URI.create("https://arca.live/0");
      if(hops<4)assertEquals(200,requests.fetch(start,policy(),100).status());
      else assertEquals("SOURCE_REDIRECT_BLOCKED",assertThrows(CollectorFailure.class,()->requests.fetch(start,policy(),100)).getMessage());
      assertEquals(Math.min(hops+1,4),sent.size());
      assertFalse(sent.contains(URI.create("https://arca.live/4")));
    }
  }
  @Test void redirectLoopAndCrossHostAreRejectedBeforeSending() {
    for(String target:List.of("/b/live","https://other.invalid/b/live","https://alias.invalid/b/live","http://arca.live/b/live")) {
      var transport=mock(SourceTransport.class);
      when(transport.get(any(),anyInt(),anyString())).thenReturn(response(302,Map.of("location",List.of(target))));
      var aliases=new SourcePolicy("arca.live",List.of("/"),"","","fixture contact.invalid","METADATA",Map.of(),List.of("alias.invalid"));
      assertThrows(CollectorFailure.class,()->new SourceRequests(transport,ignored->{},0).fetch(url,aliases,100));
      verify(transport,times(1)).get(any(),anyInt(),anyString());
    }
  }
  @Test void everyRedirectRevalidatesDnsBeforeTransportGet() {
    var transport=mock(SourceTransport.class);URI next=URI.create("https://arca.live/b/live/123");
    when(transport.get(any(),anyInt(),anyString())).thenReturn(response(302,Map.of("location",List.of(next.toString()))));
    doThrow(new CollectorFailure(403,"SOURCE_NOT_ALLOWED")).when(transport).validate(next);
    assertThrows(CollectorFailure.class,()->new SourceRequests(transport,ignored->{},0).fetch(url,policy(),100));
    verify(transport,never()).get(eq(next),anyInt(),anyString());
  }
  @Test void transientResponsesRespectIntervalAndRetryAfter() {
    var transport=mock(SourceTransport.class);var sleeps=new ArrayList<Long>();
    when(transport.get(any(),anyInt(),anyString())).thenReturn(response(503,Map.of()),response(429,Map.of("Retry-After",List.of("12"))),response(200,Map.of()));
    assertEquals(200,new SourceRequests(transport,sleeps::add,10000).fetch(url,policy(),100).status());
    assertEquals(List.of(10000L,10000L,12000L),sleeps);
  }
  @Test void retriesAreBoundedAndLongCooldownOrForbiddenNeverRetries() {
    for(int status:List.of(403,429,503)) {
      var transport=mock(SourceTransport.class);var sleeps=new ArrayList<Long>();
      when(transport.get(any(),anyInt(),anyString())).thenReturn(response(status,status==429?Map.of("retry-after",List.of("3600")):Map.of()));
      var error=assertThrows(CollectorFailure.class,()->new SourceRequests(transport,sleeps::add,10000).fetch(url,policy(),100));
      assertEquals(status,error.status());assertEquals(status==503?3:1,sleeps.size());
    }
  }
  @Test void redirectsAndSeparateAssetsShareIntervalAndPolicyChecks() {
    var transport=mock(SourceTransport.class);var sleeps=new ArrayList<Long>();
    when(transport.get(any(),anyInt(),anyString())).thenReturn(response(302,Map.of("location",List.of("/b/live/123"))),response(200,Map.of()),response(200,Map.of()));
    var requests=new SourceRequests(transport,sleeps::add,15000);
    requests.fetch(url,policy(),100);requests.fetch(URI.create("https://arca.live/image.png"),policy(),100);
    assertEquals(List.of(15000L,15000L,15000L),sleeps);
    verify(transport).validate(URI.create("https://arca.live/b/live/123"));
  }
  @Test void networkFailuresRetryButSizeAndPolicyFailuresDoNot() {
    var transport=mock(SourceTransport.class);var sleeps=new ArrayList<Long>();
    when(transport.get(any(),anyInt(),anyString())).thenThrow(new CollectorFailure(503,"SOURCE_FETCH_FAILED")).thenReturn(response(200,Map.of()));
    new SourceRequests(transport,sleeps::add,0).fetch(url,policy(),100);
    assertEquals(List.of(1000L),sleeps);
    reset(transport);when(transport.get(any(),anyInt(),anyString())).thenThrow(new CollectorFailure(413,"SOURCE_TOO_LARGE"));
    assertThrows(CollectorFailure.class,()->new SourceRequests(transport,sleeps::add,0).fetch(url,policy(),100));
    verify(transport,times(1)).get(any(),anyInt(),anyString());
  }
}
