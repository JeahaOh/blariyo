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
