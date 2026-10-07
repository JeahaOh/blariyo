package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.maintenance.*;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.*;
import com.zaxxer.hikari.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class ImageFailureReadbackTests {
  private static final byte[] PNG=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=");
  @Test void retriesOnceRecoversOrDiscardsWithDurableCleanupAndDedup(@TempDir Path root)throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank());
    var config=new HikariConfig();config.setJdbcUrl(jdbc);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));config.setMaximumPoolSize(3);
    try(var ds=new HikariDataSource(config)) {
      MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());
      var store=TestSourceControls.store(ds);var objects=new BatchObjectStore.Local(root.toString());
      String key=Long.toString(System.nanoTime());var calls=new AtomicInteger();
      var recovered=new DirectUrlRunner(network(calls,1),store,objects,ignored->{}).run(source(),options(key));
      assertEquals(1,recovered.fetched(),recovered.toString());assertEquals(2,calls.get());
      assertEquals(1,count(ds,"SELECT count(*) FROM collect.batch_item WHERE run_id='"+recovered.runId()+"' AND state='FETCHED'"));
      assertEquals(0,count(ds,"SELECT count(*) FROM collect.batch_image_cleanup c JOIN collect.batch_image_retry r USING(item_id) WHERE r.discarded_at IS NOT NULL"));
      calls.set(0);key+="1";
      var failed=new DirectUrlRunner(network(calls,100),store,objects,ignored->{}).run(source(),options(key));
      assertEquals(1,failed.failures(),failed.toString());assertEquals(2,calls.get());
      assertEquals(0,count(ds,"SELECT count(*) FROM collect.batch_item WHERE run_id='"+failed.runId()+"'"));
      assertEquals(0,count(ds,"SELECT count(*) FROM collect.batch_failure WHERE run_id='"+failed.runId()+"'"));
      assertEquals(1,count(ds,"SELECT count(*) FROM collect.batch_report WHERE run_id='"+failed.runId()+"'"));
      var duplicate=new DirectUrlRunner(network(calls,0),store,objects,ignored->{}).run(source(),options(key));
      assertEquals(1,duplicate.duplicates());assertEquals(2,calls.get(),"Deleted identity must not fetch again");
      var repository=new RetentionRepository(ds);
      var jobs=repository.imageCleanupPending();assertFalse(jobs.isEmpty());
      var job=jobs.stream().filter(j->j.run().equals(failed.runId())).findFirst().orElseThrow();
      assertFalse(repository.imageCleanupAllowed(job,"collect/raw/other/item.html"));
      var broken=new RetentionObjects(){
        public Page list(String prefix,String token){return objects.list(prefix,token);}
        public void delete(String k){throw new CollectorFailure(503,"OBJECT_DELETE_FAILED");}
        public boolean exists(String k){return objects.exists(k);}
      };
      assertTrue(new ImageFailureCleanup(repository,broken,ignored->{}).once().failed()>0);
      assertTrue(repository.imageCleanupPending().contains(job));
      var cleaned=new ImageFailureCleanup(repository,objects,ignored->{}).once();
      assertEquals(0,cleaned.failed());assertTrue(cleaned.completed()>0);
      assertFalse(objects.exists("collect/raw/"+job.run()+"/"+job.item()+".html"));
      assertTrue(repository.imageCleanupPending().isEmpty());
      assertEquals(0,new ImageFailureCleanup(repository,objects,ignored->{}).once().completed());
      // A legacy image failure's next run consumes exactly one attempt, including across runner instances.
      key+="2";UUID legacy;
      try(var lease=store.lockSource("theqoo")) {
        var run=store.begin("theqoo","manual","WRITE_DB",1,1,10000,null);
        legacy=store.claim(run,"theqoo",key,url(key));
        String raw="collect/raw/"+run+"/"+legacy+".html";
        objects.put(raw,"legacy".getBytes(StandardCharsets.UTF_8),"text/html");store.raw(legacy,raw);
        store.failItem(run,legacy,"MEDIA","SOURCE_NOT_IMAGE",Map.of("assetKind","IMAGE"));
        store.finish(run,"FAILED",Map.of("reason","SOURCE_NOT_IMAGE"),"collect/report/"+run+".jsonl",new byte[32]);
      }
      calls.set(0);
      var retried=new DirectUrlRunner(network(calls,100),store,objects,ignored->{}).run(source(),options(key));
      assertEquals(1,retried.failures());assertEquals(1,calls.get());
      assertEquals(0,count(ds,"SELECT count(*) FROM collect.batch_item WHERE id='"+legacy+"'"));
      assertEquals(2,repository.imageCleanupPending().stream().filter(j->j.item().equals(legacy)).count());
      assertEquals(0,new ImageFailureCleanup(repository,objects,ignored->{}).once().failed());
      // Crash after durable retry claim, before any failure row: old run objects must survive in cleanup inventory.
      key+="3";UUID interrupted;
      try(var lease=store.lockSource("theqoo")) {
        var run=store.begin("theqoo","manual","WRITE_DB",1,1,10000,null);
        interrupted=store.claim(run,"theqoo",key,url(key));
        String raw="collect/raw/"+run+"/"+interrupted+".html";
        objects.put(raw,"interrupted".getBytes(StandardCharsets.UTF_8),"text/html");store.raw(interrupted,raw);
        assertTrue(store.retryImage(interrupted,"SOURCE_NOT_IMAGE"));
        // Release source ownership without failItem or finish, just as a lost process would.
      }
      calls.set(0);
      var afterCrash=new DirectUrlRunner(network(calls,100),store,objects,ignored->{}).run(source(),options(key));
      assertEquals(1,afterCrash.failures());assertEquals(1,calls.get());
      var interruptedJobs=repository.imageCleanupPending().stream().filter(j->j.item().equals(interrupted)).toList();
      assertEquals(2,interruptedJobs.size());
      assertEquals(0,new ImageFailureCleanup(repository,objects,ignored->{}).once().failed());
      for(var old:interruptedJobs)assertFalse(objects.exists("collect/raw/"+old.run()+"/"+old.item()+".html"));
      // Already fetched data cannot be made into a retry/discard target.
      UUID fetched;
      try(var c=ds.getConnection();var q=c.createStatement();var r=q.executeQuery("SELECT id FROM collect.batch_item WHERE run_id='"+recovered.runId()+"'")){r.next();fetched=(UUID)r.getObject(1);}
      try(var lease=store.lockSource("theqoo")) {assertThrows(CollectorFailure.class,()->store.retryImage(fetched,"SOURCE_NOT_IMAGE"));}
      assertEquals(1,count(ds,"SELECT count(*) FROM collect.batch_item WHERE id='"+fetched+"' AND state='FETCHED'"));
    }
  }
  @Test void rateLimitedImageIsPreservedAndCooldownSurvivesNewClient(@TempDir Path root)throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank());
    var config=new HikariConfig();config.setJdbcUrl(jdbc);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());
    try(var ds=new HikariDataSource(config)) {
      var store=TestSourceControls.store(ds);var calls=new AtomicInteger();
      String key=Long.toString(System.nanoTime());
      String sourceKey="throttle-"+UUID.randomUUID();
      var isolatedConfig=(tools.jackson.databind.node.ObjectNode)source().config().deepCopy();
      isolatedConfig.put("requestIntervalMs",5000);
      var isolatedSource=new SourceRegistry.Source(sourceKey,isolatedConfig);
      SourceTransport transport=new SourceTransport() {
        public void validate(URI uri){}
        public PinnedHttp.Response get(URI uri,int maximum,String agent) {
          if(uri.getHost().equals("img.theqoo.net")) {
            calls.incrementAndGet();
            return new PinnedHttp.Response(429,"text/html",Map.of("Retry-After",List.of("3600")),new byte[0]);
          }
          return network(new AtomicInteger(),0).get(uri,maximum,agent);
        }
      };
      var report=new DirectUrlRunner(transport,store,new BatchObjectStore.Local(root.toString()),ignored->{}).run(isolatedSource,new DirectUrlRunner.Options(sourceKey,url(key),5000,true));
      assertEquals(List.of("SOURCE_RATE_LIMITED"),report.errors());assertEquals(1,calls.get());
      assertEquals(1,count(ds,"SELECT count(*) FROM collect.batch_item WHERE run_id='"+report.runId()+"' AND state='FAILED'"));
      assertEquals(0,count(ds,"SELECT count(*) FROM collect.batch_image_retry r JOIN collect.batch_item i ON i.id=r.item_id WHERE i.run_id='"+report.runId()+"'"));
      // A fresh DB connection, without the test spy, still receives the persisted wait.
      try(var c=ds.getConnection();var q=c.createStatement();var r=q.executeQuery("SELECT * FROM collect.reserve_batch_request('"+sourceKey+"',1000000,15000)")) {
        assertTrue(r.next());assertTrue(r.getLong("wait_ms")>3590000);
      }
    }
  }
  private static int count(HikariDataSource ds,String sql)throws Exception {
    try(var c=ds.getConnection();var q=c.createStatement();var r=q.executeQuery(sql)){r.next();return r.getInt(1);}
  }
  private static String url(String key){return "https://theqoo.net/hot/"+key;}
  private static DirectUrlRunner.Options options(String key){return new DirectUrlRunner.Options("theqoo",url(key),10000,true);}
  static SourceRegistry.Source source() {
    return TestSourceControls.registry(Json.tree(Map.of("theqoo",Map.of("host","theqoo.net","approved",true,"parser","THEQOO",
      "pathPrefixes",List.of("/hot/"),"userAgent","fixture contact-test","imageOrigins",Map.of("https://img.theqoo.net",List.of("/")))))).key("theqoo");
  }
  static SourceTransport network(AtomicInteger calls,int failures) {
    return TestSourceControls.allowRobots(new SourceTransport(){
      public void validate(URI uri){}
      public PinnedHttp.Response get(URI uri,int maximum,String agent) {
        if(uri.getHost().equals("img.theqoo.net")) {
          boolean fail=calls.incrementAndGet()<=failures;
          return new PinnedHttp.Response(200,fail?"text/html":"image/png",Map.of(),fail?"not image".getBytes(StandardCharsets.UTF_8):PNG);
        }
        return new PinnedHttp.Response(200,"text/html",Map.of(),("<html><head><title>fixture</title></head><body><article itemprop='articleBody'><p>body</p><img src='https://img.theqoo.net/test.png'></article></body></html>").getBytes(StandardCharsets.UTF_8));
      }
    });
  }
}
