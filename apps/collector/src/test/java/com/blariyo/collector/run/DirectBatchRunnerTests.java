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
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(x->{calls.incrementAndGet();URI u=x.getArgument(0);String html=u.getPath().endsWith("/123")?"<html><head><meta property='og:title' content='x'></head><body><div class='article-view'><div class='article-content'><p>body</p></div></div></body></html>":"<div class='article-list'><div class='vrow'><a class='title' href='/b/live/123'>x</a><time datetime='2026-09-21T12:00:00Z'></time></div></div>";return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes());});
    var report=new DirectBatchRunner(transport,store,objects).run(source(),new DirectBatchRunner.Options("arcalive","hot",1,1,Duration.ofHours(24),10000,false));
    assertEquals("COMPLETED",report.state());assertTrue(calls.get()>0);verifyNoInteractions(store,objects);
  }
  @Test void blockedSourceNeverOpensNetwork(){
    var source=new SourceRegistry(Json.tree(Map.of("x",Map.of("host","x.invalid","approved",false,"batchApproved",false,"chartVerified",false,"parser","BLOCKED","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid","imageOrigins",Map.of(),"charts",Map.of(),"blockedReason","POLICY_APPROVAL_REQUIRED")))).key("x");
    var transport=mock(SourceTransport.class);var result=new DirectBatchRunner(transport,mock(BatchStore.class),mock(BatchObjectStore.class)).run(source,new DirectBatchRunner.Options("x","hot",1,1,Duration.ofHours(24),10000,false));
    assertEquals("BLOCKED",result.state());verifyNoInteractions(transport);
  }
}
