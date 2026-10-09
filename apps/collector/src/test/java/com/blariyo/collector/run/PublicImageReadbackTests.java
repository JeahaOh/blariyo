package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.*;
import com.zaxxer.hikari.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class PublicImageReadbackTests {
  private static final byte[] PNG=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=");
  @Test void fourImageFailuresDoNotStopNextHttpCdnImageAndCooldownSurvivesRestart(@TempDir Path root)throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank());
    var config=new HikariConfig();config.setJdbcUrl(jdbc);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());
    try(var ds=new HikariDataSource(config)) {
      String id=UUID.randomUUID().toString(),sourceKey="image-test-"+id,limited="limited-"+id+".invalid";
      var source=TestSourceControls.registry(Json.tree(Map.of(sourceKey,Map.of(
          "host","arca.live","approved",true,"batchApproved",true,"chartVerified",true,"parser","ARCALIVE",
          "pathPrefixes",List.of("/b/"),"userAgent","fixture contact","charts",Map.of("hot","https://arca.live/b/live"))))).key(sourceKey);
      var calls=new ArrayList<URI>();
      SourceTransport network=new SourceTransport(){
        public void validate(URI uri){}
        public PinnedHttp.Response get(URI uri,int maximum,String agent){
          calls.add(uri);
          if(uri.getHost().equals("bad-cdn.invalid"))return response(403,"text/html",new byte[0]);
          if(uri.getHost().equals("unavailable-"+id+".invalid"))return new PinnedHttp.Response(503,"text/html",Map.of("Retry-After",List.of("3600")),new byte[0]);
          if(uri.getHost().equals(limited))return new PinnedHttp.Response(429,"text/html",Map.of("Retry-After",List.of("3600")),new byte[0]);
          if(uri.getHost().equals("new-cdn.invalid"))return response(200,"image/png",PNG);
          String html;
          if(uri.getPath().equals("/b/live"))html="<div class='article-list'>"+java.util.stream.IntStream.rangeClosed(1,5).mapToObj(n->"<div class='vrow'><a class='title' href='/b/live/"+n+"'>fixture</a></div>").collect(java.util.stream.Collectors.joining())+"</div>";
          else {
            String image=switch(uri.getPath().substring(uri.getPath().lastIndexOf('/')+1)){
              case "1" -> "http://bad-cdn.invalid/x";case "2" -> "http://127.0.0.1/x";
              case "3" -> "https://unavailable-"+id+".invalid/x";case "4" -> "http://"+limited+"/x";
              default -> "http://new-cdn.invalid/image.png";
            };
            html="<title>fixture</title><div class='article-view'><div class='article-content'><img src='"+image+"'></div></div>";
          }
          return response(200,"text/html",html.getBytes(StandardCharsets.UTF_8));
        }
      };
      var store=TestSourceControls.store(ds);
      org.mockito.Mockito.doCallRealMethod().when(store).reserveImageHost(org.mockito.ArgumentMatchers.anyString());
      var objects=new BatchObjectStore.Local(root.toString());
      var report=new DirectBatchRunner(network,store,objects,ignored->{}).run(source,new DirectBatchRunner.Options(sourceKey,"hot",1,5,Duration.ofDays(1),10000,true));
      assertEquals("PARTIAL",report.state(),report.toString());assertEquals(5,report.discovered());
      assertEquals(4,report.failures());assertEquals(1,report.fetched());
      assertEquals(List.of("SOURCE_ACCESS_BLOCKED","IMAGE_URL_NOT_ALLOWED","SOURCE_HTTP_UNAVAILABLE","SOURCE_RATE_LIMITED"),report.errors());
      assertFalse(calls.stream().anyMatch(u->u.getHost().equals("127.0.0.1")));
      try(var c=ds.getConnection();var q=c.prepareStatement("SELECT i.state,m.remote_url,m.object_key,m.sha256 FROM collect.batch_item i JOIN collect.batch_media m ON m.item_id=i.id WHERE i.run_id=? AND i.state='FETCHED'")){
        q.setObject(1,report.runId());try(var r=q.executeQuery()){
          assertTrue(r.next());assertEquals("http://new-cdn.invalid/image.png",r.getString("remote_url"));
          byte[] actual=java.nio.file.Files.readAllBytes(root.resolve(r.getString("object_key")));
          assertArrayEquals(PNG,actual);assertArrayEquals(java.security.MessageDigest.getInstance("SHA-256").digest(actual),r.getBytes("sha256"));assertFalse(r.next());
        }
      }
      // A new client still skips this CDN, without waiting an hour or deferring the article source.
      var fresh=new BatchStore(ds);
      assertEquals("IMAGE_HOST_DEFERRED",assertThrows(CollectorFailure.class,()->fresh.reserveImageHost(limited)).getMessage());
      // A different, unused CDN is immediately eligible while the throttled host remains deferred.
      fresh.reserveImageHost("unrelated-"+id+".invalid");
      Thread.sleep(2100); // Expire only the successful CDN's ordinary 2-second send permit.
      // Manual URL collection shares the new policy and also preserves HTTP remote metadata.
      var single=new DirectUrlRunner(network,store,objects,ignored->{}).run(source,new DirectUrlRunner.Options(sourceKey,"https://arca.live/b/live/6",10000,true));
      assertEquals(1,single.fetched(),single.toString());
    }
  }
  private static PinnedHttp.Response response(int status,String type,byte[] bytes){return new PinnedHttp.Response(status,type,Map.of(),bytes);}
}
