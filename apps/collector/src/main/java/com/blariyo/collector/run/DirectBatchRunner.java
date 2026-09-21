package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.time.*;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** End-to-end batch owner: network, parser, deduplication, collect ledger and object store. */
public final class DirectBatchRunner {
  public record Options(String source,String chart,int maxPages,int maxItems,Duration since,long intervalMs,boolean writeDb) {}
  public record Report(UUID runId,String source,String state,int pages,int discovered,int fetched,int duplicates,int failures,List<String> errors) {}
  private final SourceTransport transport; private final BatchStore store; private final BatchObjectStore objects;
  public DirectBatchRunner(SourceTransport transport,BatchStore store,BatchObjectStore objects){this.transport=transport;this.store=store;this.objects=objects;}
  public Report run(SourceRegistry.Source source,Options o){
    UUID run=UUID.randomUUID();
    boolean runStarted=false;
    int pages=0,discovered=0,fetched=0,duplicates=0,failures=0;var errors=new ArrayList<String>();var seen=new HashSet<String>();var visited=new HashSet<URI>();
    try {
      var policy=source.policy();var adapter=source.adapter();String chart=source.config().path("charts").path(o.chart()).asText();
      if(chart.isBlank()||!source.config().path("chartVerified").asBoolean(false))throw new CollectorFailure(403,"CHART_UNVERIFIED");
      if(o.writeDb()){run=store.begin(source.key(),o.chart(),"WRITE_DB",o.maxPages(),o.maxItems(),o.intervalMs(),Instant.now().minus(o.since()));runStarted=true;}
      URI next=policy.allow(chart);Instant cutoff=Instant.now().minus(o.since());
      while(next!=null&&pages<o.maxPages()&&discovered<o.maxItems()){
        if(!visited.add(next))throw new CollectorFailure(422,"PAGINATION_LOOP");
        byte[] list=fetchBytes(next,policy,10*1024*1024);var page=adapter.list(list,next);pages++;
        for(var entry:page.entries()){
          if(discovered>=o.maxItems())break;String key=entry.identity().postKey();if(!seen.add(key)){duplicates++;continue;}discovered++;
          if(entry.publishedAt()==null||entry.publishedAt().isBefore(cutoff))continue;
          try{URI detail=entry.identity().canonical();byte[] html=fetchBytes(detail,policy,10*1024*1024);JsonNode result=adapter.detail(html,detail,policy);String rawKey="collect/raw/"+run+"/"+key+".html";String title=result.path("title").asText();
            if(o.writeDb()){String blocks=result.path("contentBlocks").toString(),sns=sns(result.path("contentBlocks"));UUID item=store.item(run,source.key(),key,result.path("canonicalUrl").asText(detail.toString()),"FETCHED",title,blocks,sns,null);if(item==null){duplicates++;continue;}var raw=objects.put(rawKey,html,"text/html");store.raw(item,raw.objectKey());for(var image:result.path("imageCandidates"))storeMedia(policy,store,item,image);}
            fetched++;
          }catch(CollectorFailure e){failures++;errors.add(e.getMessage());if(failures>=3)break;}
        }
        if(failures>=3)break;next=page.next();
      }
      String state=failures>0?(fetched==0?"FAILED":"PARTIAL"):(o.writeDb()?"COMPLETED":"COMPLETED");if(o.writeDb())store.finish(run,state,Map.of("pages",pages,"items",discovered,"fetched",fetched),"collect/report/"+run+".jsonl");return new Report(run,source.key(),state,pages,discovered,fetched,duplicates,failures,List.copyOf(errors));
    }catch(CollectorFailure e){if(runStarted)store.finish(run,"BLOCKED",Map.of("pages",pages,"items",discovered,"reason",e.getMessage()),"collect/report/"+run+".jsonl");return new Report(run,source.key(),"BLOCKED",pages,discovered,fetched,duplicates,failures,List.of(e.getMessage()));}
  }
  private byte[] fetchBytes(URI url,SourcePolicy policy,int maximum){return fetch(url,policy,maximum).bytes();}
  private PinnedHttp.Response fetch(URI url,SourcePolicy policy,int maximum){policy.allow(url.toString());transport.validate(url);var r=transport.get(url,maximum,policy.userAgent());if(r.status()!=200)throw new CollectorFailure(r.status()==404?404:403,r.status()==404?"SOURCE_GONE":"SOURCE_ACCESS_BLOCKED");return r;}
  private static String sns(JsonNode blocks){var a=new ArrayList<String>();for(var b:blocks)if("LINK".equals(b.path("type").asText())&&b.path("url").asText().matches("https://(x.com|twitter.com|www.instagram.com|www.youtube.com|youtu.be|www.tiktok.com)/.*"))a.add(b.path("url").asText());return Json.tree(a).toString();}
  private void storeMedia(SourcePolicy policy,BatchStore store,UUID item,JsonNode image){
    URI remote=URI.create(image.path("remoteUrl").asText());
    var response=fetch(remote,policy.imagePolicy(remote.toString()),10*1024*1024);
    if(!response.contentType().toLowerCase(Locale.ROOT).startsWith("image/"))throw new CollectorFailure(415,"SOURCE_NOT_IMAGE");
    String key="collect/media/"+item+"/"+image.path("position").asInt();
    var object=objects.put(key,response.bytes(),response.contentType());
    store.media(item,image.path("position").asInt(),"IMAGE",remote.toString(),object.objectKey(),object.sha256(),object.contentType(),object.bytes());
  }
}
