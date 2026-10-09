package com.blariyo.collector.run;

import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.zaxxer.hikari.*;
import org.junit.jupiter.api.*;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SourceCollectionSettingsReadbackTests {
  @Test void persistedSwitchSurvivesRestartAndStopsHttpIncludingAfterQuotaWait() throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank());
    var cfg=new HikariConfig();cfg.setJdbcUrl(jdbc);cfg.setUsername(System.getenv("COLLECTOR_READBACK_DATABASE_USER"));cfg.setPassword(System.getenv("COLLECTOR_READBACK_DATABASE_PASSWORD"));cfg.setMaximumPoolSize(3);
    MigrationMain.migrate(jdbc,cfg.getUsername(),cfg.getPassword());
    try(var db=new HikariDataSource(cfg)) {
      String key="setting-"+UUID.randomUUID();
      var source=TestSourceControls.registry(Json.tree(Map.of(key,Map.ofEntries(
          Map.entry("host","theqoo.net"),Map.entry("approved",false),Map.entry("enabled",false),Map.entry("blockedReason","SOURCE_DISABLED"),
          Map.entry("parser","THEQOO"),Map.entry("pathPrefixes",List.of("/hot/")),Map.entry("userAgent","fixture contact-test"),
          Map.entry("batchApproved",true),Map.entry("chartVerified",true),Map.entry("collectionPolicy","HOT_LIST"),
          Map.entry("charts",Map.of("hot","https://theqoo.net/hot")))))).key(key);
      var store=TestSourceControls.store(db);var settings=new SourceCollectionSettings(store);settings.sync(source);
      var transport=mock(SourceTransport.class);var calls=new AtomicInteger();
      when(transport.get(any(),anyInt(),anyString())).thenAnswer(call->{calls.incrementAndGet();return new PinnedHttp.Response(200,"text/html",Map.of(),new byte[]{1});});
      var report=new DirectBatchRunner(transport,store,null,ignored->{}).run(source,new DirectBatchRunner.Options(key,"hot",1,1,Duration.ofHours(24),10000,false));
      assertEquals("SKIPPED",report.state());assertEquals(0,calls.get());
      String actor="admin:v1:"+"a".repeat(43);
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT collect.set_source_collection_setting(?,true,0,?)")){q.setString(1,key);q.setString(2,actor);q.execute();}
      // Reading the original disabled file again must not overwrite the saved ON.
      settings.sync(source);var effective=new BatchStore(db).collectionSource(source);assertTrue(effective.config().path("approved").asBoolean());
      var requests=SourceRequests.controlled(transport,ignored->{},10000,effective,store,()->{});
      assertEquals(200,requests.fetch(URI.create("https://theqoo.net/hot/123456"),effective.policy(),100).status());assertEquals(1,calls.get());
      // Simulate the administrator switching OFF while the next request waits for its permit.
      doAnswer(call->{
        try(var c=db.getConnection();var q=c.prepareStatement("SELECT collect.set_source_collection_setting(?,false,1,?)")){q.setString(1,key);q.setString(2,actor);q.execute();}
        ((Runnable)call.getArgument(4)).run();return null;
      }).when(store).reserveRequest(anyString(),anyInt(),anyLong(),any(),any());
      assertEquals("SOURCE_DISABLED",assertThrows(CollectorFailure.class,()->requests.fetch(URI.create("https://theqoo.net/hot/123457"),effective.policy(),100)).getMessage());
      assertEquals(1,calls.get());
      assertEquals("SOURCE_DISABLED",assertThrows(CollectorFailure.class,()->new BatchStore(db).collectionSource(source)).getMessage());
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT collection_enabled,lock_version,source_url,(SELECT count(*) FROM collect.batch_source_collection_setting_change WHERE source_key=?) AS changes FROM collect.batch_source_collection_setting WHERE source_key=?")) {
        q.setString(1,key);q.setString(2,key);try(var r=q.executeQuery()){assertTrue(r.next());assertFalse(r.getBoolean(1));assertEquals(2,r.getInt(2));assertEquals("https://theqoo.net/hot",r.getString(3));assertEquals(2,r.getInt(4));}
      }
    }
  }
}
