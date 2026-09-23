package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.Test;

class MediaBudgetRunnerTests {
  private SourceRegistry.Source source() {
    var config=Json.tree(Map.of("host","arca.live","approved",true,"batchApproved",true,"chartVerified",true,
        "parser","ARCALIVE","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid",
        "imageOrigins",Map.of(),"charts",Map.of("hot","https://arca.live/b/live"),
        "mediaLimits",Map.of("maxFileBytes",8,"maxTotalBytes",10)));
    return new SourceRegistry.Source("arcalive",config);
  }
  private SourceTransport transport() {
    var transport=mock(SourceTransport.class);
    when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{
      URI uri=call.getArgument(0);int max=call.getArgument(1);
      if(uri.getPath().endsWith(".png")||uri.getPath().endsWith(".pdf")) {
        if(max<8)throw new CollectorFailure(413,"SOURCE_TOO_LARGE");
        return new PinnedHttp.Response(200,uri.getPath().endsWith(".png")?"image/png":"application/pdf",Map.of(),new byte[8]);
      }
      String html=uri.getPath().equals("/b/live")?"<div class='article-list'>"+
        java.util.stream.IntStream.rangeClosed(101,106).mapToObj(i->"<div class='vrow'><a class='title' href='/b/live/"+i+"'>post</a></div>").collect(java.util.stream.Collectors.joining())+"</div>":
        "<title>gallery</title><div class='article-view'><div class='article-content'><img src='https://arca.live/one.png'>"+
        (uri.getPath().endsWith("106")?"":"<a href='https://arca.live/file.pdf'>attachment</a>")+"</div></div>";
      return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes());
    });return transport;
  }
  private BatchStore store() {
    var store=mock(BatchStore.class);
    when(store.begin(anyString(),anyString(),anyString(),anyInt(),anyInt(),anyLong(),any())).thenReturn(UUID.randomUUID());
    when(store.claim(any(),anyString(),anyString(),anyString())).thenAnswer(call->UUID.randomUUID());return store;
  }
  private BatchObjectStore objects() {
    var objects=mock(BatchObjectStore.class);
    when(objects.put(anyString(),any(),anyString())).thenAnswer(call->new BatchObjectStore.Record(call.getArgument(0),new byte[32],((byte[])call.getArgument(1)).length,call.getArgument(2)));
    return objects;
  }
  @Test void listBudgetIncludesFilesStopsWritesButContinuesNextArticlesWithFreshBudget() {
    var transport=transport();var store=store();var objects=objects();
    var result=new DirectBatchRunner(transport,store,objects,ignored->{}).run(source(),new DirectBatchRunner.Options("arcalive","hot",1,6,Duration.ofHours(24),10000,true));
    assertEquals("PARTIAL",result.state());assertEquals(5,result.failures());assertEquals(1,result.fetched());
    assertTrue(result.errors().stream().allMatch("SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED"::equals));
    verify(objects,times(6)).put(startsWith("collect/media/"),any(),eq("image/png"));
    verify(objects,never()).put(anyString(),any(),eq("application/pdf"));
    verify(transport,times(5)).get(eq(URI.create("https://arca.live/file.pdf")),eq(3),anyString());
    verify(store,times(1)).completeItem(any());
  }
  @Test void manualUrlUsesSameBudgetAndCannotMarkPartialMediaComplete() {
    var store=store();var objects=objects();
    var result=new DirectUrlRunner(transport(),store,objects,ignored->{}).run(source(),new DirectUrlRunner.Options("arcalive","https://arca.live/b/live/101",10000,true));
    assertEquals("FAILED",result.state());assertEquals(List.of("SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED"),result.errors());
    verify(store,never()).completeItem(any());verify(objects,never()).put(anyString(),any(),eq("application/pdf"));
  }
}
