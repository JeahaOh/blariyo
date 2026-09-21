package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.ops.BatchMain;
import com.blariyo.collector.source.*;
import com.blariyo.collector.shared.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class DiscoveryBatchTests {
  private SourceRegistry.Source source() {
    return new SourceRegistry(Json.tree(Map.of("arcalive",Map.of("host","arca.live","approved",true,"batchApproved",true,"chartVerified",true,
        "parser","ARCALIVE","pathPrefixes",List.of("/b/"),"userAgent","fixture contact-fixture.invalid",
        "charts",Map.of("hot","https://arca.live/b/live"))))).key("arcalive");
  }
  private byte[] list(String suffix, boolean next) {
    return ("<div class='article-list'><div class='vrow'><a class='title' href='/b/live/"+suffix+"'>post</a>"
        + "<time datetime='2026-09-21T10:00:00Z'></time></div></div>"
        + (next ? "<a href='/b/live?p=2'>next</a>" : "")).getBytes();
  }
  private DiscoveryBatch.Options options(boolean write) { return new DiscoveryBatch.Options("arcalive","hot",2,20,Duration.ofHours(24),10000,write); }
  @Test void dryRunDoesNotWriteAndRepeatedPostIsDeduplicated() {
    var writes=new AtomicInteger(); var requests=new AtomicInteger();
    var report=new DiscoveryBatch().run(source(),options(false),url->{requests.incrementAndGet();return list("123",url.getQuery()==null);},
        (key,url)->{writes.incrementAndGet();return Map.of();},Instant.parse("2026-09-21T12:00:00Z"));
    assertEquals("DISCOVERED",report.state()); assertEquals(2,requests.get());assertEquals(0,writes.get());
    assertEquals(1,report.discovered());assertEquals(1,report.duplicates());
  }
  @Test void queueUsesCanonicalIdentityAndStopsOnSiteFailure() {
    var requests=new AtomicInteger();
    var report=new DiscoveryBatch().run(source(),options(true),url->{if(requests.incrementAndGet()>1)throw new CollectorFailure(403,"SOURCE_ACCESS_BLOCKED");return list("123",true);},
        (key,url)->{assertEquals("arcalive:123",key);assertEquals("https://arca.live/b/live/123",url);return Map.of("candidateId",1);},Instant.parse("2026-09-21T12:00:00Z"));
    assertEquals("FAILED",report.state());assertEquals(1,report.jobs().size());assertEquals(2,requests.get());
  }
  @Test void capSinceUnknownDateAndInvalidOptions() {
    var limited=new DiscoveryBatch.Options("arcalive","hot",1,1,Duration.ofHours(1),10000,false);
    var report=new DiscoveryBatch().run(source(),limited,url->list("1",true),(k,u)->Map.of(),Instant.parse("2026-09-21T12:00:00Z"));
    assertEquals(1,report.pages());assertEquals(0,report.eligible());
    var unknown=new DiscoveryBatch().run(source(),limited,url->new String(list("1",false)).replace(" datetime='2026-09-21T10:00:00Z'","").getBytes(),(k,u)->Map.of(),Instant.now());
    assertEquals("PARTIAL",unknown.state());assertEquals(1,unknown.unknownDates());
    assertThrows(CollectorFailure.class,()->BatchMain.options(new String[]{"batch","--source","theqoo","--dry-run","--write-db"}));
    assertThrows(CollectorFailure.class,()->BatchMain.options(new String[]{"batch","--source","theqoo","--dry-run","--recrawl","update"}));
  }
}
