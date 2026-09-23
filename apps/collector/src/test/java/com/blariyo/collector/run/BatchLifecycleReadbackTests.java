package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class BatchLifecycleReadbackTests {
  private HikariDataSource database() throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank(),"COLLECTOR_READBACK_DATABASE_URL not set");
    var cfg=new HikariConfig();cfg.setJdbcUrl(jdbc);cfg.setMaximumPoolSize(4);
    cfg.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    cfg.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    MigrationMain.migrate(jdbc,cfg.getUsername(),cfg.getPassword());return new HikariDataSource(cfg);
  }
  private SourceRegistry.Source source(boolean strict) {
    return new SourceRegistry(Json.tree(Map.of("arcalive",Map.ofEntries(
      Map.entry("host","arca.live"),Map.entry("approved",true),Map.entry("batchApproved",true),Map.entry("chartVerified",true),
      Map.entry("parser","ARCALIVE"),Map.entry("userAgent","fixture contact.invalid"),Map.entry("pathPrefixes",List.of("/")),
      Map.entry("imageOrigins",Map.of()),Map.entry("charts",Map.of("hot","https://arca.live/b/live")),
      Map.entry("datePolicy",strict?"REQUIRE_KNOWN":"INCLUDE_UNKNOWN"))))).key("arcalive");
  }
  private static PinnedHttp.Response html(String content){return new PinnedHttp.Response(200,"text/html",Map.of(),content.getBytes(StandardCharsets.UTF_8));}
  private static String good(){return "<title>fixture</title><div class='article-view'><div class='article-content'><p>whole body</p></div></div>";}
  private static String entry(String key,Instant when){return "<div class='vrow'><a class='title' href='/b/live/"+key+"'>post</a>"+(when==null?"":"<time datetime='"+when+"'></time>")+"</div>";}
  private static SourceTransport network(Function<URI,PinnedHttp.Response> get){return new SourceTransport(){public void validate(URI u){} public PinnedHttp.Response get(URI u,int n,String agent){return get.apply(u);}};}
  private static UUID item(HikariDataSource db,String key) throws Exception {
    try(var c=db.getConnection();var q=c.prepareStatement("SELECT id FROM collect.batch_item WHERE source_key='arcalive' AND source_post_key=?")){
      q.setString(1,key);try(var r=q.executeQuery()){assertTrue(r.next());return (UUID)r.getObject(1);}
    }
  }
  @Test void listFailuresHaveItemsAndPhasesAndParseFailureRetainsRaw(@TempDir Path root) throws Exception {
    try(var db=database()) {
      var store=new BatchStore(db);String base=Long.toString(System.nanoTime());
      var network=network(uri->{
        if(uri.getPath().equals("/b/live"))return html("<div class='article-list'>"+entry(base+"1",null)+entry(base+"2",null)+entry(base+"3",null)+"</div>");
        String key=uri.getPath().substring(uri.getPath().lastIndexOf('/')+1);
        try(var c=db.getConnection();var q=c.prepareStatement("SELECT state FROM collect.batch_item WHERE source_post_key=?")) {
          q.setString(1,key);try(var r=q.executeQuery()){assertTrue(r.next(),"claim precedes network");assertEquals("FETCHING",r.getString(1));}
        }catch(java.sql.SQLException e){throw new AssertionError(e);}
        if(key.endsWith("1"))return new PinnedHttp.Response(404,"text/html",Map.of(),new byte[0]);
        return html(key.endsWith("2")?"<title>empty original</title><div class='article-view'><div class='article-content'></div></div>":good());
      });
      var report=new DirectBatchRunner(network,store,new BatchObjectStore.Local(root.toString()),x->{})
        .run(source(false),new DirectBatchRunner.Options("arcalive","hot",1,3,Duration.ofHours(24),10000,true));
      assertEquals("PARTIAL",report.state());assertEquals(1,report.fetched());assertEquals(2,report.failures());
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT i.source_post_key,i.state,i.raw_object_key,f.phase,f.code FROM collect.batch_item i LEFT JOIN collect.batch_failure f ON f.item_id=i.id AND f.run_id=i.run_id WHERE i.run_id=? ORDER BY i.source_post_key")) {
        q.setObject(1,report.runId());try(var r=q.executeQuery()) {
          assertTrue(r.next());assertEquals("FAILED",r.getString("state"));assertEquals("FETCH",r.getString("phase"));assertEquals("SOURCE_GONE",r.getString("code"));assertNull(r.getString("raw_object_key"));
          assertTrue(r.next());assertEquals("FAILED",r.getString("state"));assertEquals("PARSE",r.getString("phase"));assertNotNull(r.getString("code"));assertTrue(Files.readString(root.resolve(r.getString("raw_object_key"))).contains("empty original"));
          assertTrue(r.next());assertEquals("FETCHED",r.getString("state"));assertNull(r.getString("phase"));assertFalse(r.next());
        }
      }
    }
  }
  @Test void manualParseFailureRetriesSameItemAndFetchedDuplicateMakesNoNetworkRequest(@TempDir Path root) throws Exception {
    try(var db=database()) {
      var store=new BatchStore(db);var objects=new BatchObjectStore.Local(root.toString());
      String key=Long.toString(System.nanoTime()),url="https://arca.live/b/live/"+key;
      var opts=new DirectUrlRunner.Options("arcalive",url,10000,true);
      var failed=new DirectUrlRunner(network(u->html("<title>empty</title>")),store,objects,x->{}).run(source(false),opts);
      assertEquals("FAILED",failed.state());UUID original=item(db,key);
      var good=new DirectUrlRunner(network(u->html(good())),store,objects,x->{}).run(source(false),opts);
      assertEquals(1,good.fetched());assertEquals(original,item(db,key));
      var duplicate=new DirectUrlRunner(network(u->{throw new AssertionError("duplicate must not fetch");}),store,objects,x->{}).run(source(false),opts);
      assertEquals(1,duplicate.duplicates());assertEquals(0,duplicate.fetched());
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT count(*) FROM collect.batch_failure WHERE run_id=? AND item_id=? AND phase='PARSE'")){
        q.setObject(1,failed.runId());q.setObject(2,original);try(var r=q.executeQuery()){assertTrue(r.next());assertEquals(1,r.getInt(1));}
      }
    }
  }
  @Test void dateExclusionIsNotFailureAndCanBeReconsidered(@TempDir Path root) throws Exception {
    try(var db=database()) {
      var store=new BatchStore(db);var objects=new BatchObjectStore.Local(root.toString());String base=Long.toString(System.nanoTime());
      var transport=network(u->{if(u.getPath().equals("/b/live"))return html("<div class='article-list'>"+entry(base+"1",Instant.now().minus(Duration.ofDays(2)))+entry(base+"2",null)+"</div>");
        assertTrue(u.getPath().endsWith("2"),"known old post must not fetch");return html(good());});
      var options=new DirectBatchRunner.Options("arcalive","hot",1,2,Duration.ofHours(24),10000,true);
      var excluded=new DirectBatchRunner(transport,store,objects,x->{}).run(source(true),options);
      assertEquals("COMPLETED",excluded.state());assertEquals(2,excluded.skippedByDate());assertEquals(0,excluded.failures());assertEquals(0,excluded.fetched());
      UUID unknown=item(db,base+"2");
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT state,skip_reason,failure_code FROM collect.batch_item WHERE run_id=? ORDER BY source_post_key")) {
        q.setObject(1,excluded.runId());try(var r=q.executeQuery()){
          assertTrue(r.next());assertEquals("SKIPPED_POLICY",r.getString(1));assertEquals("SOURCE_OUTSIDE_WINDOW",r.getString(2));assertNull(r.getString(3));
          assertTrue(r.next());assertEquals("SKIPPED_POLICY",r.getString(1));assertEquals("SOURCE_DATE_UNKNOWN",r.getString(2));assertNull(r.getString(3));
        }
      }
      var included=new DirectBatchRunner(transport,store,objects,x->{}).run(source(false),options);
      assertEquals(1,included.fetched());assertEquals(unknown,item(db,base+"2"));
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT skip_reason,state FROM collect.batch_item WHERE id=?")){
        q.setObject(1,unknown);try(var r=q.executeQuery()){assertTrue(r.next());assertNull(r.getString(1));assertEquals("FETCHED",r.getString(2));}
      }
    }
  }
}
