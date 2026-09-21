package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class DiscoveryFetcherTests {
  private CoreClient core() {
    var core = mock(CoreClient.class);
    when(core.collectorId()).thenReturn("fixture");
    when(core.post(anyString(), anyString(), any())).thenAnswer(call -> {
      var now = Instant.now();
      return Json.tree(Map.of("serverNow", now.toString(), "validUntil", now.plusSeconds(10).toString(),
          "nextAllowedAt", now.toString()));
    });
    return core;
  }
  private final SourcePolicy policy = new SourcePolicy("fixture.invalid", List.of("/"), "title", "img", "fixture contact-fixture.invalid");
  private PinnedHttp.Response response(int status, String type, String body) {
    return new PinnedHttp.Response(status, type, Map.of("content-type", List.of(type)), body.getBytes());
  }
  @Test void eachRobotsAndListRequestReservesQuotaAndNeverRetries403() {
    var core = core(); var transport = mock(SourceTransport.class);
    when(transport.get(any(), anyInt(), anyString())).thenReturn(
        response(200,"text/plain","User-agent: *\nAllow: /"), response(403,"text/html","blocked"));
    var fetcher = new DiscoveryFetcher(policy,transport,core,1,0);
    var error = assertThrows(CollectorFailure.class, () -> fetcher.fetch(URI.create("https://fixture.invalid/list")));
    assertEquals("SOURCE_ACCESS_BLOCKED", error.getMessage());
    verify(transport,times(2)).get(any(),anyInt(),anyString());
    verify(core,times(2)).post(eq("/sources/1/request-reservations"),anyString(),any());
  }
  @Test void challengeRobotsStopsBeforeList() {
    var core=core();var transport=mock(SourceTransport.class);
    when(transport.get(any(),anyInt(),anyString())).thenReturn(response(200,"text/html","<html>challenge</html>"));
    var error=assertThrows(CollectorFailure.class,()->new DiscoveryFetcher(policy,transport,core,1,0).fetch(URI.create("https://fixture.invalid/list")));
    assertEquals("ROBOTS_UNVERIFIED",error.getMessage());
    verify(transport,times(1)).get(any(),anyInt(),anyString());
  }
}
