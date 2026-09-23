package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class DirectBatchRunnerTests {
  private SourceRegistry.Source source(){return new SourceRegistry(Json.tree(Map.of("arcalive",Map.of("host","arca.live","approved",true,"batchApproved",true,"chartVerified",true,"parser","ARCALIVE","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid","imageOrigins",Map.of(),"charts",Map.of("hot","https://arca.live/b/live"))))).key("arcalive");}
  @Test void dryRunNeverTouchesStoreOrDatabase(){
    var transport=mock(SourceTransport.class);var store=mock(BatchStore.class);var objects=mock(BatchObjectStore.class);var calls=new AtomicInteger();
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(x->{calls.incrementAndGet();URI u=x.getArgument(0);String html=u.getPath().endsWith("/123")?"<html><head><meta property='og:title' content='x'></head><body><div class='article-view'><div class='article-content'><p>body</p></div></div></body></html>":"<div class='article-list'><div class='vrow'><a class='title' href='/b/live/123'>x</a><time datetime='"+java.time.Instant.now()+"'></time></div></div>";return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes());});
    var report=new DirectBatchRunner(transport,store,objects,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",1,1,Duration.ofHours(24),10000,false));
    assertEquals("COMPLETED",report.state());assertEquals(2,calls.get());assertEquals(1,report.fetched());verifyNoInteractions(store,objects);
  }
  @Test void blockedSourceNeverOpensNetwork(){
    var source=new SourceRegistry(Json.tree(Map.of("x",Map.of("host","x.invalid","approved",false,"batchApproved",false,"chartVerified",false,"parser","BLOCKED","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid","imageOrigins",Map.of(),"charts",Map.of(),"blockedReason","POLICY_APPROVAL_REQUIRED")))).key("x");
    var transport=mock(SourceTransport.class);var result=new DirectBatchRunner(transport,mock(BatchStore.class),mock(BatchObjectStore.class)).run(source,new DirectBatchRunner.Options("x","hot",1,1,Duration.ofHours(24),10000,false));
    assertEquals("BLOCKED",result.state());verifyNoInteractions(transport);
  }
  @Test void stoppedRunCheckpointRetainsCountersForReportReadback() {
    var transport=mock(SourceTransport.class);var store=mock(BatchStore.class);var objects=mock(BatchObjectStore.class);var run=UUID.randomUUID();
    when(store.begin(anyString(),anyString(),anyString(),anyInt(),anyInt(),anyLong(),any())).thenReturn(run);
    when(transport.get(any(),anyInt(),anyString())).thenReturn(new PinnedHttp.Response(403,"text/html",Map.of(),new byte[0]));
    var report=new DirectBatchRunner(transport,store,objects,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",1,1,Duration.ofHours(24),10000,true));
    assertEquals("BLOCKED",report.state());
    verify(store).finish(eq(run),eq("BLOCKED"),argThat(c->Objects.equals(c.get("fetched"),0)&&Objects.equals(c.get("unknownDates"),0)&&Objects.equals(c.get("skippedByDate"),0)),anyString(),any(byte[].class));
  }
  @Test void detailAccessBlockStopsSiteInsteadOfFetchingTheRemainingList() {
    var transport=mock(SourceTransport.class);
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{URI u=call.getArgument(0);
      if(!u.getPath().equals("/b/live"))return new PinnedHttp.Response(403,"text/html",Map.of(),new byte[0]);
      String html="<div class='article-list'><div class='vrow'><a class='title' href='/b/live/123'>one</a></div><div class='vrow'><a class='title' href='/b/live/124'>two</a></div></div>";
      return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes());
    });
    var report=new DirectBatchRunner(transport,null,null,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",2,5,Duration.ofHours(24),10000,false));
    assertEquals("BLOCKED",report.state());assertEquals(1,report.discovered());assertEquals(1,report.failures());
    verify(transport,times(2)).get(any(),anyInt(),anyString());
  }
  @Test void sourceCapsAreEnforcedBeforeFetching() {
    var transport=mock(SourceTransport.class);
    var report=new DirectBatchRunner(transport,null,null,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",3,1,Duration.ofHours(24),10000,false));
    assertEquals(List.of("SOURCE_LIMIT_EXCEEDED"),report.errors());assertEquals(1,report.failures());
    verifyNoInteractions(transport);
  }
  @Test void oversizedPostsAreSkippedWithinTheItemCapWithoutStoppingTheSite() {
    var transport=mock(SourceTransport.class);
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{URI u=call.getArgument(0);
      String html=u.getPath().equals("/b/live")?"<div class='article-list'>"+java.util.stream.IntStream.rangeClosed(1,5).mapToObj(i->"<div class='vrow'><a class='title' href='/b/live/"+i+"'>post</a></div>").collect(java.util.stream.Collectors.joining())+"</div>":
        "<title>long gallery</title><div class='article-view'><div class='article-content'>"+"<img src='https://arca.live/image.jpg'>".repeat(201)+"</div></div>";
      return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes());
    });
    var result=new DirectBatchRunner(transport,null,null,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",1,5,Duration.ofHours(24),10000,false));
    assertEquals(5,result.discovered());assertEquals(5,result.failures());assertEquals(0,result.fetched());
    assertTrue(result.errors().stream().allMatch("SOURCE_IMAGE_LIMIT_EXCEEDED"::equals));
    verify(transport,times(6)).get(any(),anyInt(),anyString());
  }
  @Test void missingDateIsReportedAndStrictDatePolicyDoesNotStoreIt() {
    var transport=mock(SourceTransport.class);
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{URI u=call.getArgument(0);
      String html=u.getPath().equals("/b/live")?"<div class='article-list'><div class='vrow'><a class='title' href='/b/live/123'>one</a></div></div>":"<title>undated</title><div class='article-view'><div class='article-content'><p>body</p></div></div>";
      return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes());
    });
    var permissive=new DirectBatchRunner(transport,null,null,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",1,1,Duration.ofHours(24),10000,false));
    assertEquals(1,permissive.fetched());assertEquals(1,permissive.unknownDates());
    var config=Json.parse(source().config().toString().replace("\"chartVerified\":true","\"chartVerified\":true,\"datePolicy\":\"REQUIRE_KNOWN\"").getBytes());
    var strict=new DirectBatchRunner(transport,null,null,ignored->{}).run(new SourceRegistry.Source("arcalive",config),new DirectBatchRunner.Options("arcalive","hot",1,1,Duration.ofHours(24),10000,false));
    assertEquals(0,strict.fetched());assertEquals(1,strict.skippedByDate());assertEquals(1,strict.unknownDates());
  }
}
