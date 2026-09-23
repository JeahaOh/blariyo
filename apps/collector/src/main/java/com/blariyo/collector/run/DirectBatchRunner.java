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
  public record Report(UUID runId,String source,String state,int pages,int discovered,int fetched,int duplicates,int failures,int unknownDates,int skippedByDate,List<String> errors) {}
  private final SourceTransport transport; private final BatchStore store; private final BatchObjectStore objects;
  private final LongConsumer sleeper;
  private SourceRequests requests;
  private ArticleMediaBudget mediaBudget;
  public DirectBatchRunner(SourceTransport transport,BatchStore store,BatchObjectStore objects){this(transport,store,objects,DirectBatchRunner::sleep);}
  DirectBatchRunner(SourceTransport transport,BatchStore store,BatchObjectStore objects,LongConsumer sleeper){this.transport=transport;this.store=store;this.objects=objects;this.sleeper=sleeper;}
  public Report run(SourceRegistry.Source source,Options o){
    UUID run=UUID.randomUUID();
    boolean runStarted=false;
    int pages=0,discovered=0,fetched=0,duplicates=0,failures=0,siteFailures=0,unknownDates=0,skippedByDate=0;var errors=new ArrayList<String>();var seen=new HashSet<String>();var visited=new HashSet<URI>();
    requests=new SourceRequests(transport,sleeper,o.intervalMs());
    BatchStore.SourceLock lease=null;
    try {
      if(o.writeDb())lease=store.lockSource(source.key());
      var policy=source.policy();var adapter=source.adapter();String chart=source.config().path("charts").path(o.chart()).asText();
      if(!source.config().path("batchApproved").asBoolean(false))throw new CollectorFailure(403,"BATCH_NOT_APPROVED");
      if(o.maxPages()>source.config().path("maxPages").asInt(2)||o.maxItems()>source.config().path("maxItems").asInt(20)
          ||o.intervalMs()<source.config().path("requestIntervalMs").asLong(10000))throw new CollectorFailure(400,"SOURCE_LIMIT_EXCEEDED");
      if(chart.isBlank()||!source.config().path("chartVerified").asBoolean(false))throw new CollectorFailure(403,"CHART_UNVERIFIED");
      if(o.writeDb()){store.registerSource(source.key(),source.config().path("host").asText());run=store.begin(source.key(),o.chart(),"WRITE_DB",o.maxPages(),o.maxItems(),o.intervalMs(),Instant.now().minus(o.since()));runStarted=true;}
      URI next=policy.allow(chart);Instant cutoff=Instant.now().minus(o.since());
      while(next!=null&&pages<o.maxPages()&&discovered<o.maxItems()){
        if(!visited.add(next))throw new CollectorFailure(422,"PAGINATION_LOOP");
        byte[] list=fetchBytes(next,policy,30*1024*1024);var page=adapter.list(list,next);pages++;
        for(var entry:page.entries()){
          if(discovered>=o.maxItems())break;String key=entry.identity().postKey();if(!seen.add(key)){duplicates++;continue;}discovered++;
          UUID item = null;String phase="CLAIM";
          var failureDetail = new LinkedHashMap<String, Object>();
          failureDetail.put("sourcePostKey", key);
          try{
            URI detail=entry.identity().canonical();
            failureDetail.put("detailUrl", detail.toString());

            if(o.writeDb()) {
              item=store.claim(run,source.key(),key,detail.toString());
              if(item==null){duplicates++;continue;}
              failureDetail.put("itemId",item.toString());
            }
            if(entry.publishedAt()!=null&&(entry.publishedAt().isBefore(cutoff)||entry.publishedAt().isAfter(Instant.now().plusSeconds(300)))) {
              if(o.writeDb())store.skipItem(item,"SOURCE_OUTSIDE_WINDOW");skippedByDate++;continue;
            }
            phase="FETCH";
            byte[] html=fetchBytes(detail,policy,30*1024*1024);
            if(o.writeDb()) {
              phase="RAW";String rawKey="collect/raw/"+run+"/"+objectName(key)+".html";
              var raw=objects.put(rawKey,html,"text/html");store.raw(item,raw.objectKey());failureDetail.put("rawObjectKey",raw.objectKey());
            }
            phase="PARSE";
            JsonNode result=adapter.detail(html,detail,policy);
            String canonical=result.path("canonicalUrl").asText(detail.toString());
            if(!adapter.identify(URI.create(canonical)).postKey().equals(key))throw new CollectorFailure(422,"SOURCE_IDENTITY_CHANGED");
            Instant published=entry.publishedAt();
            if(result.hasNonNull("sourcePublishedAt"))try{published=Instant.parse(result.path("sourcePublishedAt").asText());}catch(java.time.format.DateTimeParseException ignored){}
            if(published==null){unknownDates++;if("REQUIRE_KNOWN".equals(source.config().path("datePolicy").asText())){
              if(o.writeDb())store.skipItem(item,"SOURCE_DATE_UNKNOWN");skippedByDate++;continue;
            }} else if(published.isBefore(cutoff)||published.isAfter(Instant.now().plusSeconds(300))){
              if(o.writeDb())store.skipItem(item,"SOURCE_OUTSIDE_WINDOW");skippedByDate++;continue;
            }
            if(o.writeDb()){
              phase="PERSIST";
              store.parsed(item,canonical,result.path("title").asText(),result.path("contentBlocks").toString(),
                result.path("attachmentCandidates").toString(),sns(result.path("contentBlocks")));
              phase="MEDIA";
          mediaBudget=new ArticleMediaBudget(policy.mediaLimits());
              for(var image:result.path("imageCandidates")){
                try{ storeMedia(policy,store,run,item,image); }
                catch(CollectorFailure e){ failureDetail.put("assetKind","IMAGE"); failureDetail.put("assetUrl",image.path("remoteUrl").asText()); throw e; }
              }
              int offset=result.path("imageCandidates").size();
              for(var attachment:result.path("attachmentCandidates")){
                try{ storeAttachment(policy,store,run,item,attachment,offset); }
                catch(CollectorFailure e){ failureDetail.put("assetKind","FILE"); failureDetail.put("assetUrl",attachment.path("remoteUrl").asText()); throw e; }
              }
              store.completeItem(item);
            }
            fetched++;
          }catch(CollectorFailure e){
            if("true".equalsIgnoreCase(System.getenv("COLLECTOR_DEBUG_ERRORS")))e.printStackTrace(System.err);
            failures++;errors.add(e.getMessage());
            if(o.writeDb()&&runStarted)store.failItem(run,item,phase,e.getMessage(),failureDetail);
            // A deleted or oversized post says nothing about the structure/accessibility of the next post.
            if(!Set.of("SOURCE_GONE","SOURCE_TOO_LARGE","SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED","SOURCE_IMAGE_LIMIT_EXCEEDED","SOURCE_BODY_LIMIT_EXCEEDED","SOURCE_TEXT_LIMIT_EXCEEDED").contains(e.getMessage()))siteFailures++;
            if(SourceRequests.stopSite(e))throw e;
            if(siteFailures>=3)break;
          }
        }
        if(o.writeDb())store.checkpoint(run,Map.of("pages",pages,"items",discovered,"fetched",fetched,"unknownDates",unknownDates,"skippedByDate",skippedByDate));
        if(siteFailures>=3)break;next=page.next();
      }
      String state=failures>0?(fetched==0?"FAILED":"PARTIAL"):(o.writeDb()?"COMPLETED":"COMPLETED");
      var report = new Report(run,source.key(),state,pages,discovered,fetched,duplicates,failures,unknownDates,skippedByDate,List.copyOf(errors));
      if(o.writeDb()){String reportKey="collect/report/"+run+".jsonl";objects.put(reportKey,reportBytes(report),"application/jsonl");store.finish(run,state,Map.of("pages",pages,"items",discovered,"fetched",fetched,"unknownDates",unknownDates,"skippedByDate",skippedByDate),reportKey,BatchStore.sha(new String(reportBytes(report),StandardCharsets.UTF_8)));}
      return report;
    }catch(CollectorFailure e){
      if(failures==0){failures=1;if(runStarted)store.failItem(run,null,"LIST",e.getMessage());}
      if(errors.isEmpty()||!errors.getLast().equals(e.getMessage()))errors.add(e.getMessage());
      var report = new Report(run,source.key(),e.status()==403?"BLOCKED":"FAILED",pages,discovered,fetched,duplicates,failures,unknownDates,skippedByDate,List.copyOf(errors));
      if(runStarted){String reportKey="collect/report/"+run+".jsonl";objects.put(reportKey,reportBytes(report),"application/jsonl");store.finish(run,report.state(),Map.of("pages",pages,"items",discovered,"fetched",fetched,"unknownDates",unknownDates,"skippedByDate",skippedByDate,"reason",e.getMessage()),reportKey,BatchStore.sha(new String(reportBytes(report),StandardCharsets.UTF_8)));}
      return report;
    } finally { if(lease!=null)lease.close(); }
  }
  private static byte[] reportBytes(Report report){return (Json.tree(report).toString()+"\n").getBytes(StandardCharsets.UTF_8);}
  private byte[] fetchBytes(URI url,SourcePolicy policy,int maximum){return fetch(url,policy,maximum).bytes();}
  private PinnedHttp.Response fetch(URI url, SourcePolicy policy, int maximum) {
    return requests.fetch(url,policy,maximum);
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
  private PinnedHttp.Response fetchAsset(URI remote, SourcePolicy policy) {
    PinnedHttp.Response response;
    try { response=fetch(remote,policy,mediaBudget.requestLimit()); }
    catch(CollectorFailure error) {
      if ("SOURCE_TOO_LARGE".equals(error.getMessage()) && mediaBudget.totalIsBinding())
        throw new CollectorFailure(413,"SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED");
      throw error;
    }
    mediaBudget.accept(response.bytes().length);
    return response;
  }
  private static String sns(JsonNode blocks){var a=new ArrayList<String>();for(var b:blocks)if("LINK".equals(b.path("type").asText())&&b.path("url").asText().matches("https://(x.com|twitter.com|www.instagram.com|www.youtube.com|youtu.be|www.tiktok.com)/.*"))a.add(b.path("url").asText());return Json.tree(a).toString();}
  private void storeMedia(SourcePolicy policy,BatchStore store,UUID run,UUID item,JsonNode image){storeAsset(policy,store,run,item,image.path("position").asInt(),"IMAGE",image.path("remoteUrl").asText(),true);}
  private void storeAttachment(SourcePolicy policy,BatchStore store,UUID run,UUID item,JsonNode attachment,int offset){storeAsset(policy,store,run,item,offset+attachment.path("position").asInt(),"FILE",attachment.path("remoteUrl").asText(),false);}
  private void storeAsset(SourcePolicy policy,BatchStore store,UUID run,UUID item,int position,String kind,String remoteUrl,boolean requireImage){
    URI remote=URI.create(remoteUrl);

    SourcePolicy assetPolicy;
    try { assetPolicy = policy.imagePolicy(remote.toString()); }
    catch (CollectorFailure e) {
      if ("true".equalsIgnoreCase(System.getenv("COLLECTOR_DEBUG_ERRORS"))) System.err.println("asset policy rejected: " + remote);
      throw e;
    }
    var response=fetchAsset(remote,assetPolicy);
    String contentType=requireImage?SourceImageType.detect(response.bytes(),response.contentType()):response.contentType();
    if(requireImage&&!contentType.toLowerCase(Locale.ROOT).startsWith("image/"))throw new CollectorFailure(415,"SOURCE_NOT_IMAGE");
    String key="collect/media/"+run+"/"+item+"/"+position;
    var object=objects.put(key,response.bytes(),contentType);
    store.media(item,position,kind,remote.toString(),object.objectKey(),object.sha256(),object.contentType(),object.bytes());
  }
}
