package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.ops.BatchMain;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class SourceRequestPolicyTests {
  @Test void defaultsMatchCliAndPublishedRuntime() {
    var config=Json.tree(Map.of("host","fixture.invalid","approved",true,"collectionPolicy","DETAIL_ONLY",
        "parser","METADATA","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid"));
    assertEquals(5000,SourceRequestPolicy.interval(config));
    assertEquals(5000,SourceRequestPolicy.dailyLimit(config));
    assertEquals(5000,BatchMain.options(new String[]{"batch","--source","fixture","--dry-run"}).intervalMillis());
    var runtime=BatchSourceRuntime.policy(new SourceRegistry.Source("fixture",config));
    assertTrue(runtime.path("enabled").asBoolean());
    assertEquals(5000,runtime.path("requestIntervalMs").asInt());
    assertEquals(5000,runtime.path("dailyRequestLimit").asInt());
  }
  @Test void sourceOverridesAndValidationHaveOneDefinition() {
    for(int interval:List.of(1000,5000,30000,3600000))
      assertEquals(interval,SourceRequestPolicy.interval(Json.tree(Map.of("requestIntervalMs",interval))));
    assertEquals(200,SourceRequestPolicy.dailyLimit(Json.tree(Map.of("dailyRequestLimit",200))));
    for(Object interval:List.of(0,999,3600001,"5000",5.5))
      assertThrows(CollectorFailure.class,()->SourceRequestPolicy.interval(Json.tree(Map.of("requestIntervalMs",interval))));
    for(Object limit:List.of(0,1000001,"5000",5.5))
      assertThrows(CollectorFailure.class,()->SourceRequestPolicy.dailyLimit(Json.tree(Map.of("dailyRequestLimit",limit))));
    assertThrows(CollectorFailure.class,()->BatchMain.options(new String[]{"batch","--source","fixture","--dry-run","--interval-ms","999"}));
  }
}
