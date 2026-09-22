package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.function.LongConsumer;
import tools.jackson.databind.JsonNode;

/** End-to-end batch owner: network, parser, deduplication, collect ledger and object store. */
public final class DirectBatchRunner {
  public record Options(String source,String chart,int maxPages,int maxItems,Duration since,long intervalMs,boolean writeDb) {}
  public record Report(UUID runId,String source,String state,int pages,int discovered,int fetched,int duplicates,int failures,List<String> errors) {}
  private final SourceTransport transport; private final BatchStore store; private final BatchObjectStore objects;
  private final LongConsumer sleeper;
  public DirectBatchRunner(SourceTransport transport,BatchStore store,BatchObjectStore objects){this(transport,store,objects,DirectBatchRunner::sleep);}
  DirectBatchRunner(SourceTransport transport,BatchStore store,BatchObjectStore objects,LongConsumer sleeper){this.transport=transport;this.store=store;this.objects=objects;this.sleeper=sleeper;}
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
        byte[] list=fetchBytes(next,policy,30*1024*1024);var page=adapter.list(list,next);pages++;
        for(var entry:page.entries()){
          if(discovered>=o.maxItems())break;String key=entry.identity().postKey();if(!seen.add(key)){duplicates++;continue;}discovered++;
          if(entry.publishedAt()!=null&&entry.publishedAt().isBefore(cutoff))continue;
          UUID item = null;
          var failureDetail = new LinkedHashMap<String, Object>();
          failureDetail.put("sourcePostKey", key);
          try{
            URI detail=entry.identity().canonical();
            failureDetail.put("detailUrl", detail.toString());
            pause(o.intervalMs());
            byte[] html=fetchBytes(detail,policy,30*1024*1024);
            JsonNode result=adapter.detail(html,detail,policy);
            String rawKey="collect/raw/"+run+"/"+objectName(key)+".html";String title=result.path("title").asText();
            if(o.writeDb()){
              String blocks=result.path("contentBlocks").toString(),attachments=result.path("attachmentCandidates").toString(),sns=sns(result.path("contentBlocks"));
              item=store.item(run,source.key(),key,result.path("canonicalUrl").asText(detail.toString()),"FETCHING",title,blocks,attachments,sns,null);
              if(item==null){duplicates++;continue;}
              failureDetail.put("itemId", item.toString());
              var raw=objects.put(rawKey,html,"text/html");store.raw(item,raw.objectKey());
              for(var image:result.path("imageCandidates")){
                try{ storeMedia(policy,store,item,image); }
                catch(CollectorFailure e){ failureDetail.put("assetKind","IMAGE"); failureDetail.put("assetUrl",image.path("remoteUrl").asText()); throw e; }
              }
              int offset=result.path("imageCandidates").size();
              for(var attachment:result.path("attachmentCandidates")){
                try{ storeAttachment(policy,store,item,attachment,offset); }
                catch(CollectorFailure e){ failureDetail.put("assetKind","FILE"); failureDetail.put("assetUrl",attachment.path("remoteUrl").asText()); throw e; }
              }
              store.completeItem(item);
            }
            fetched++;
          }catch(CollectorFailure e){if("true".equalsIgnoreCase(System.getenv("COLLECTOR_DEBUG_ERRORS")))e.printStackTrace(System.err);failures++;errors.add(e.getMessage());if(o.writeDb()&&runStarted)store.failItem(run,item,"DETAIL",e.getMessage(),failureDetail);if(failures>=3)break;}
        }
        if(failures>=3)break;next=page.next();
      }
      String state=failures>0?(fetched==0?"FAILED":"PARTIAL"):(o.writeDb()?"COMPLETED":"COMPLETED");
      var report = new Report(run,source.key(),state,pages,discovered,fetched,duplicates,failures,List.copyOf(errors));
      if(o.writeDb()){String reportKey="collect/report/"+run+".jsonl";objects.put(reportKey,reportBytes(report),"application/jsonl");store.finish(run,state,Map.of("pages",pages,"items",discovered,"fetched",fetched),reportKey);}
      return report;
    }catch(CollectorFailure e){
      var report = new Report(run,source.key(),"BLOCKED",pages,discovered,fetched,duplicates,failures,List.of(e.getMessage()));
      if(runStarted){String reportKey="collect/report/"+run+".jsonl";objects.put(reportKey,reportBytes(report),"application/jsonl");store.finish(run,"BLOCKED",Map.of("pages",pages,"items",discovered,"reason",e.getMessage()),reportKey);}
      return report;
    }
  }
  private static byte[] reportBytes(Report report){return (Json.tree(report).toString()+"\n").getBytes(StandardCharsets.UTF_8);}
  private byte[] fetchBytes(URI url,SourcePolicy policy,int maximum){return fetch(url,policy,maximum).bytes();}
  private PinnedHttp.Response fetch(URI url,SourcePolicy policy,int maximum){
    URI current=url;
    for(int redirects=0;redirects<5;redirects++){
      policy.allow(current.toString());transport.validate(current);var r=transport.get(current,maximum,policy.userAgent());
      if(r.status()==200)return r;
      if(r.status()>=300&&r.status()<400){
        var location=r.headers().getOrDefault("location",List.of()).stream().findFirst().orElse("");
        if(!location.isBlank()){
          URI redirected = current.resolve(location);
          try { current=policy.allow(redirected.toString()); }
          catch (CollectorFailure e) {
            if ("true".equalsIgnoreCase(System.getenv("COLLECTOR_DEBUG_ERRORS"))) System.err.println("redirect policy rejected: " + current + " -> " + redirected);
            throw e;
          }
          continue;
        }
      }
      throw new CollectorFailure(r.status()==404?404:403,r.status()==404?"SOURCE_GONE":"SOURCE_ACCESS_BLOCKED");
    }
    throw new CollectorFailure(403,"SOURCE_REDIRECT_LOOP");
  }
  private void pause(long millis){if(millis>0)sleeper.accept(millis);}
  private static void sleep(long millis){try{Thread.sleep(millis);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new CollectorFailure(503,"BATCH_INTERRUPTED");}}
  private static String objectName(String value){
    String slug=value.replaceAll("[^A-Za-z0-9._-]+","_").replaceAll("^_+|_+$","");
    if(slug.isBlank())slug="post";
    if(slug.length()>80)slug=slug.substring(0,80);
    try{var digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));return slug+"-"+BatchObjectStore.hex(digest).substring(0,12);}
    catch(Exception e){throw new IllegalStateException(e);}
  }
  private static String sns(JsonNode blocks){var a=new ArrayList<String>();for(var b:blocks)if("LINK".equals(b.path("type").asText())&&b.path("url").asText().matches("https://(x.com|twitter.com|www.instagram.com|www.youtube.com|youtu.be|www.tiktok.com)/.*"))a.add(b.path("url").asText());return Json.tree(a).toString();}
  private void storeMedia(SourcePolicy policy,BatchStore store,UUID item,JsonNode image){storeAsset(policy,store,item,image.path("position").asInt(),"IMAGE",image.path("remoteUrl").asText(),true);}
  private void storeAttachment(SourcePolicy policy,BatchStore store,UUID item,JsonNode attachment,int offset){storeAsset(policy,store,item,offset+attachment.path("position").asInt(),"FILE",attachment.path("remoteUrl").asText(),false);}
  private static String detectedImageContentType(byte[] bytes,String contentType){
    String lower=contentType==null?"":contentType.toLowerCase(Locale.ROOT);
    if(lower.startsWith("image/"))return contentType;
    if(bytes.length>=8&&(bytes[0]&255)==0x89&&bytes[1]==0x50&&bytes[2]==0x4e&&bytes[3]==0x47&&bytes[4]==0x0d&&bytes[5]==0x0a&&bytes[6]==0x1a&&bytes[7]==0x0a)return "image/png";
    if(bytes.length>=3&&(bytes[0]&255)==0xff&&(bytes[1]&255)==0xd8&&(bytes[2]&255)==0xff)return "image/jpeg";
    if(bytes.length>=6&&bytes[0]=='G'&&bytes[1]=='I'&&bytes[2]=='F'&&bytes[3]=='8')return "image/gif";
    if(bytes.length>=12&&bytes[0]=='R'&&bytes[1]=='I'&&bytes[2]=='F'&&bytes[3]=='F'&&bytes[8]=='W'&&bytes[9]=='E'&&bytes[10]=='B'&&bytes[11]=='P')return "image/webp";
    if(bytes.length>=12&&bytes[4]=='f'&&bytes[5]=='t'&&bytes[6]=='y'&&bytes[7]=='p'&&bytes[8]=='a'&&bytes[9]=='v'&&bytes[10]=='i'&&bytes[11]=='f')return "image/avif";
    return contentType;
  }
  private void storeAsset(SourcePolicy policy,BatchStore store,UUID item,int position,String kind,String remoteUrl,boolean requireImage){
    URI remote=URI.create(remoteUrl);
    pause(1000);
    SourcePolicy assetPolicy;
    try { assetPolicy = policy.imagePolicy(remote.toString()); }
    catch (CollectorFailure e) {
      if ("true".equalsIgnoreCase(System.getenv("COLLECTOR_DEBUG_ERRORS"))) System.err.println("asset policy rejected: " + remote);
      throw e;
    }
    var response=fetch(remote,assetPolicy,30*1024*1024);
    String contentType=requireImage?detectedImageContentType(response.bytes(),response.contentType()):response.contentType();
    if(requireImage&&!contentType.toLowerCase(Locale.ROOT).startsWith("image/"))throw new CollectorFailure(415,"SOURCE_NOT_IMAGE");
    String key="collect/media/"+item+"/"+position;
    var object=objects.put(key,response.bytes(),contentType);
    store.media(item,position,kind,remote.toString(),object.objectKey(),object.sha256(),object.contentType(),object.bytes());
  }
}
