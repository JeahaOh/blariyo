package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import java.net.URI;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.*;

/** Source evidence capture. Only direct request quota is written; no content/object publication. */
public final class SiteProbeMain {
  public static void main(String[] args) {
    var report=new LinkedHashMap<String,Object>();
    try {
      if(args.length<2||args.length>3||!Set.of("list","detail").contains(args[1]))throw new CollectorFailure(400,"PROBE_OPTIONS_INVALID");
      var source=SourceRegistry.read(System.getenv().getOrDefault("COLLECTOR_SOURCES_FILE","apps/collector/ops/reference-sites.sources.example.json")).key(args[0]);
      String mode=args[1],chart=source.config().path("defaultChart").asText("hot");
      String requested=args.length==3?args[2]:source.config().path("charts").path(chart).asText();
      report.put("source",source.key());report.put("mode",mode);report.put("at",Instant.now().toString());
      if(requested.isBlank())throw new CollectorFailure(403,"LIST_NOT_CONFIGURED");
      URI url=source.policy().allow(requested);report.put("url",url.toString());
      var responses=new ArrayList<Map<String,Object>>();report.put("responses",responses);
      var http=new PinnedHttp();
      var observed=new SourceTransport(){
        public void validate(URI uri){http.validate(uri);}
        public PinnedHttp.Response get(URI uri,int maximum,String userAgent){
          var response=http.get(uri,maximum,userAgent);
          // Status and digest remain available when the shared request policy rejects an HTTP response.
          // Never record response headers, cookies or challenge tokens.
          responses.add(Map.of("status",response.status(),"bytes",response.bytes().length,"sha256",Json.sha(response.bytes())));
          return response;
        }
      };
      String settings=System.getenv("COLLECTOR_CONFIG_FILE");
      if(settings!=null&&!settings.isBlank())com.blariyo.collector.config.OperatorSettings.load(settings);
      var config=new com.zaxxer.hikari.HikariConfig();
      config.setJdbcUrl(com.blariyo.collector.config.OperatorSettings.url());
      config.setUsername(com.blariyo.collector.config.OperatorSettings.user());
      config.setPassword(com.blariyo.collector.config.OperatorSettings.password());config.setMaximumPoolSize(2);
      PinnedHttp.Response response;
      try(var db=new com.zaxxer.hikari.HikariDataSource(config)) {
        var store=new BatchStore(db);
        var requests=SourceRequests.controlled(observed,millis->{try{Thread.sleep(millis);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new CollectorFailure(503,"BATCH_INTERRUPTED");}},source.config().path("requestIntervalMs").asLong(10000),source,store,()->{});
        try(var lease=store.lockSource(source.key())){response=requests.fetch(url,source.policy(),30*1024*1024);}
      }
      report.put("httpStatus",response.status());
      Path root=Path.of(".local-data/site-probes",source.key());Files.createDirectories(root);
      Path file=root.resolve(System.currentTimeMillis()+"-"+mode+".html");
      Files.write(file,response.bytes(),StandardOpenOption.CREATE_NEW);
      if(Files.getFileStore(file).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));
      report.put("rawPath",file.toString());report.put("rawSha256",Json.sha(response.bytes()));report.put("rawBytes",response.bytes().length);
      if(mode.equals("list")) {
        var page=source.adapter().list(response.bytes(),url);
        report.put("entries",page.entries().stream().map(e->Map.of("url",e.identity().canonical().toString(),"key",e.identity().postKey(),"publishedAt",e.publishedAt()==null?"":e.publishedAt().toString())).toList());
        report.put("next",page.next()==null?"":page.next().toString());
      }else {
        var parsed=source.adapter().detail(response.bytes(),url,source.policy());
        report.put("blocks",parsed.path("contentBlocks").size());report.put("images",parsed.path("imageCandidates").size());report.put("attachments",parsed.path("attachmentCandidates").size());
        report.put("parser",parsed.path("parserVersion").asText());
      }
      report.put("state","PARSED");
    }catch(CollectorFailure e){report.put("state","BLOCKED_OR_FAILED");report.put("code",e.getMessage());report.put("failureStatus",e.status());}
    catch(Exception e){report.put("state","FAILED");report.put("code","PROBE_FAILED");}
    System.out.println(Json.tree(report));
    if(!"PARSED".equals(report.get("state")))System.exit(2);
  }
}
