package com.blariyo.collector.run;

import com.blariyo.collector.source.*;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.sql.DataSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Parser/lifecycle fixtures use explicit synthetic source controls, never real source traffic. */
final class TestSourceControls {
  static SourceRegistry registry(JsonNode input) {
    var fixture=Json.parse(input.toString().getBytes(StandardCharsets.UTF_8));
    for(var entry:fixture.properties())((ObjectNode)entry.getValue()).put("dailyRequestLimit",1000000);
    return new SourceRegistry(fixture);
  }
  static SourceTransport allowRobots(SourceTransport delegate) {
    return new SourceTransport() {
      public void validate(URI uri){delegate.validate(uri);}
      public PinnedHttp.Response get(URI uri,int maximum,String agent) {
        if(uri.getPath().equals("/robots.txt"))return new PinnedHttp.Response(200,"text/plain",Map.of(),"User-agent: *\nAllow: /\n".getBytes(StandardCharsets.UTF_8));
        return delegate.get(uri,maximum,agent);
      }
    };
  }
  // These fixtures isolate lifecycle/ownership from real waiting. The SQL quota and real waits
  // are covered separately by DirectRequestBudgetTests; SourceRequestsTests checks every charge.
  static BatchStore store(DataSource db) {
    var store=spy(new BatchStore(db));
    doAnswer(call->{((Runnable)call.getArgument(4)).run();return null;}).when(store)
        .reserveRequest(anyString(),anyInt(),anyLong(),any(),any());
    return store;
  }
}
