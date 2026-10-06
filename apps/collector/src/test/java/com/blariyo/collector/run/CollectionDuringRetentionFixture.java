package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.*;
import com.zaxxer.hikari.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

/** Actual list/queue runners against a disposable DB; external HTTP is a deterministic fixture. */
public final class CollectionDuringRetentionFixture {
  public static void main(String[] args) {
    if (org.slf4j.LoggerFactory.getLogger("com.zaxxer.hikari") instanceof ch.qos.logback.classic.Logger logger)
      logger.setLevel(ch.qos.logback.classic.Level.WARN);
    System.out.println(Json.tree(collect()));
  }
  public static Map<String,Object> collect() {
    var env=System.getenv();String url=env.get("COLLECTION_FIXTURE_JDBC");
    if(url==null||!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:(55449|5439)/nest_[a-f0-9]{12}"))
      throw new IllegalArgumentException("ISOLATED_COLLECTION_DATABASE_REQUIRED");
    var config=new HikariConfig();config.setJdbcUrl(url);config.setUsername(env.get("COLLECTION_FIXTURE_USER"));
    config.setPassword("");config.setMaximumPoolSize(3);
    String source="independent-"+UUID.randomUUID(),key=Long.toUnsignedString(System.nanoTime());
    var sources=TestSourceControls.registry(Json.tree(Map.of(source,Map.ofEntries(
      Map.entry("host","arca.live"),Map.entry("approved",true),Map.entry("batchApproved",true),
      Map.entry("chartVerified",true),Map.entry("parser","ARCALIVE"),Map.entry("pathPrefixes",List.of("/")),
      Map.entry("userAgent","fixture contact@example.invalid"),Map.entry("charts",Map.of("hot","https://arca.live/b/live")),
      Map.entry("maxPages",1),Map.entry("maxItems",1),Map.entry("requestIntervalMs",10000)))));
    var transport=TestSourceControls.allowRobots(new SourceTransport() {
      public void validate(URI uri) {}
      public PinnedHttp.Response get(URI uri,int max,String agent) {
        if(uri.getPath().equals("/image.png"))return new PinnedHttp.Response(200,"image/png",Map.of(),Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="));
        String html=uri.getPath().equals("/b/live")
          ? "<div class='article-list'><div class='vrow'><a class='title' href='/b/live/"+key+"'>new</a><time datetime='"+Instant.now()+"'></time></div></div>"
          : "<title>New while old expires</title><div class='article-view'><div class='article-content'><p>New original body</p><img src='https://arca.live/image.png'></div></div>";
        return new PinnedHttp.Response(200,"text/html",Map.of(),html.getBytes(StandardCharsets.UTF_8));
      }
    });
    try(var db=new HikariDataSource(config)) {
      var store=TestSourceControls.store(db);var objects=new BatchObjectStore.Local(env.get("COLLECTION_FIXTURE_DIRECTORY"));
      var list=new DirectBatchRunner(transport,store,objects,ignored->{})
        .run(sources.key(source),new DirectBatchRunner.Options(source,"hot",1,1,Duration.ofHours(24),10000,true));
      if(!list.state().equals("COMPLETED")||list.fetched()!=1)throw new AssertionError("LIST_COLLECTION_FAILED "+list);
      new BatchQueueStore(store).enqueue(source,key+"1","https://arca.live/b/live/"+key+"1");
      var queue=new BatchQueueWorker(store,()->sources,transport,objects,ignored->{}).once(source);
      if(!queue.outcome().equals("COMPLETED"))throw new AssertionError("QUEUE_COLLECTION_FAILED "+queue);
      return Map.of("source",source,"listRun",list.runId(),"queueRun",queue.runId());
    }
  }
}
