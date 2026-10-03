package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.sun.net.httpserver.HttpServer;
import com.zaxxer.hikari.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;

class DirectHttpControlReadbackTests {
  @Test void realLoopbackHttpHonorsRobotsDelayQuotaAndNewClient() throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank(),"COLLECTOR_READBACK_DATABASE_URL not set");
    var config=new HikariConfig();config.setJdbcUrl(jdbc);config.setMaximumPoolSize(2);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());
    var paths=Collections.synchronizedList(new ArrayList<String>());
    var times=Collections.synchronizedList(new ArrayList<Long>());
    var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    server.createContext("/",exchange->{
      paths.add(exchange.getRequestURI().getPath());times.add(System.nanoTime());
      boolean robots=exchange.getRequestURI().getPath().equals("/robots.txt");
      byte[] body=(robots?"User-agent: *\nDisallow: /blocked\nCrawl-delay: 12\n":"<title>Fixture</title>").getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type",robots?"text/plain":"text/html");
      exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();
    });server.start();
    String key="http-budget-"+UUID.randomUUID();
    var source=new SourceRegistry(Json.tree(Map.of(key,Map.of("host","fixture.invalid","approved",true,
      "parser","METADATA","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid",
      "dailyRequestLimit",2,"requestIntervalMs",10000)))).key(key);
    try(var db=new HikariDataSource(config);var http=HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()) {
      // Explicit test adapter: all packets go to this owned loopback server. Production PinnedHttp is unchanged.
      SourceTransport transport=new SourceTransport() {
        public void validate(URI uri){assertEquals("fixture.invalid",uri.getHost());}
        public PinnedHttp.Response get(URI uri,int maximum,String agent) {
          try {
            var target=URI.create("http://127.0.0.1:"+server.getAddress().getPort()+uri.getRawPath());
            var response=http.send(HttpRequest.newBuilder(target).GET().header("User-Agent",agent).build(),HttpResponse.BodyHandlers.ofByteArray());
            return new PinnedHttp.Response(response.statusCode(),response.headers().firstValue("content-type").orElse(""),response.headers().map(),response.body());
          }catch(Exception error){throw new AssertionError(error);}
        }
      };
      var requests=SourceRequests.controlled(transport,DirectHttpControlReadbackTests::sleep,10000,source,new BatchStore(db),()->{});
      assertEquals("ROBOTS_DISALLOWED",assertThrows(CollectorFailure.class,()->requests.fetch(URI.create("https://fixture.invalid/blocked"),source.policy(),1024)).getMessage());
      assertEquals(List.of("/robots.txt"),paths);
      requests.fetch(URI.create("https://fixture.invalid/allowed"),source.policy(),1024);
      assertEquals(List.of("/robots.txt","/allowed"),paths);
      assertTrue(times.get(1)-times.get(0)>=12_000_000_000L,"Crawl-delay must be observed at the receiving server");
      assertEquals("SOURCE_DAILY_LIMIT_EXCEEDED",assertThrows(CollectorFailure.class,()->
        SourceRequests.controlled(transport,DirectHttpControlReadbackTests::sleep,10000,source,new BatchStore(db),()->{})
          .fetch(URI.create("https://fixture.invalid/new-client"),source.policy(),1024)).getMessage());
      assertEquals(List.of("/robots.txt","/allowed"),paths,"a fresh client must not reset the day or send robots again");
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT request_count FROM collect.batch_request_budget WHERE source_key=?")) {
        q.setString(1,key);try(var row=q.executeQuery()){assertTrue(row.next());assertEquals(2,row.getInt(1));}
      }
    }finally{server.stop(0);}
  }
  private static void sleep(long millis) {
    try{Thread.sleep(millis);}catch(InterruptedException error){Thread.currentThread().interrupt();throw new AssertionError(error);}
  }
}
