package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.function.LongConsumer;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/** Direct manual URL owner: fetch one approved detail URL, parse it, and write collect.batch_* directly. */
public final class DirectUrlRunner {
  public record Options(String source, String url, long intervalMs, boolean writeDb) {}
  public record Report(UUID runId, String source, String state, int fetched, int duplicates, int failures, List<String> errors) {}
  private final SourceTransport transport;
  private final BatchStore store;
  private final BatchObjectStore objects;
  private final LongConsumer sleeper;
  private SourceRequests requests;
  private ArticleMediaBudget mediaBudget;

  public DirectUrlRunner(SourceTransport transport, BatchStore store, BatchObjectStore objects) {
    this(transport, store, objects, DirectUrlRunner::sleep);
  }
  DirectUrlRunner(SourceTransport transport, BatchStore store, BatchObjectStore objects, LongConsumer sleeper) {
    this.transport = transport;
    this.store = store;
    this.objects = objects;
    this.sleeper = sleeper;
  }

  public Report run(SourceRegistry.Source source, Options options) {
    return run(source,options,false,ignored->{});
  }
  Report runQueued(SourceRegistry.Source source, Options options, java.util.function.Consumer<UUID> started) {
    if(!options.writeDb())throw new CollectorFailure(400,"BATCH_MODE_REQUIRED");
    return run(source,options,true,started);
  }
  private Report run(SourceRegistry.Source source, Options options, boolean sourceLocked, java.util.function.Consumer<UUID> started) {
    UUID run=UUID.randomUUID(),item=null;
    boolean runStarted=false,itemComplete=false;
    int fetched=0,duplicates=0;
    String phase="CLAIM";
    var failureDetail=new LinkedHashMap<String,Object>();
    requests=new SourceRequests(transport,sleeper,options.intervalMs());
    BatchStore.SourceLock lease=null;
    try {
      if(options.writeDb()&&!sourceLocked)lease=store.lockSource(source.key());
      if(options.writeDb()) {
        store.registerSource(source.key(),source.config().path("host").asText());
        run=store.begin(source.key(),sourceLocked?"discord":"manual","WRITE_DB",1,1,options.intervalMs(),null);runStarted=true;
        started.accept(run);
      }
      var policy=source.policy();
      URI detail=policy.allow(source.canonical(options.url()));
      String postKey=postKey(source,detail);
      failureDetail.put("detailUrl",detail.toString());failureDetail.put("sourcePostKey",postKey);
      if(options.writeDb()) {
        item=store.claim(run,source.key(),postKey,detail.toString());
        if(item==null)duplicates=1;else failureDetail.put("itemId",item.toString());
      }
      if(duplicates==0) {
        phase="FETCH";
        byte[] html=fetchBytes(detail,policy,30*1024*1024);
        if(options.writeDb()) {
          phase="RAW";
          var raw=objects.put("collect/raw/"+run+"/"+objectName(postKey)+".html",html,"text/html");store.raw(item,raw.objectKey());failureDetail.put("rawObjectKey",raw.objectKey());
        }
        phase="PARSE";
        JsonNode result=policy.extract(html,detail);
        String canonical=result.path("canonicalUrl").asText(detail.toString());
        if(!postKey(source,URI.create(canonical)).equals(postKey))throw new CollectorFailure(422,"SOURCE_IDENTITY_CHANGED");
        if(options.writeDb()) {
          phase="PERSIST";
          store.parsed(item,canonical,result.path("title").asText(),result.path("contentBlocks").toString(),
            result.path("attachmentCandidates").toString(),sns(result.path("contentBlocks")));
          phase="MEDIA";
          mediaBudget=new ArticleMediaBudget(policy.mediaLimits());
          for(var image:result.path("imageCandidates")) {
            try {storeMedia(policy,store,run,item,image);}
            catch(CollectorFailure e){failureDetail.put("assetKind","IMAGE");failureDetail.put("assetUrl",image.path("remoteUrl").asText());throw e;}
          }
          int offset=result.path("imageCandidates").size();
          for(var attachment:result.path("attachmentCandidates")) {
            try {storeAttachment(policy,store,run,item,attachment,offset);}
            catch(CollectorFailure e){failureDetail.put("assetKind","FILE");failureDetail.put("assetUrl",attachment.path("remoteUrl").asText());throw e;}
          }
          store.completeItem(item);itemComplete=true;
        }
        fetched=1;
      }
      phase="REPORT";
      var report=new Report(run,source.key(),"COMPLETED",fetched,duplicates,0,List.of());
      if(options.writeDb())finish(run,report,Map.of("items",1,"fetched",fetched));
      return report;
    }catch(CollectorFailure e) {
      var report=new Report(run,source.key(),e.status()==403?"BLOCKED":"FAILED",fetched,duplicates,1,List.of(e.getMessage()));
      if(runStarted) {
        store.failItem(run,itemComplete?null:item,phase,e.getMessage(),failureDetail);
        finish(run,report,Map.of("items",1,"fetched",fetched,"reason",e.getMessage()));
      }
      return report;
    }finally{if(lease!=null)lease.close();}
  }

  private void finish(UUID run, Report report, Map<String, Object> checkpoint) {
    String reportKey = "collect/report/" + run + ".jsonl";
    objects.put(reportKey, (Json.tree(report).toString() + "\n").getBytes(StandardCharsets.UTF_8), "application/jsonl");
    store.finish(run, report.state(), checkpoint, reportKey, BatchStore.sha(Json.tree(report).toString() + "\n"));
  }
  private byte[] fetchBytes(URI url, SourcePolicy policy, int maximum) { return fetch(url, policy, maximum).bytes(); }
  private PinnedHttp.Response fetch(URI url, SourcePolicy policy, int maximum) {
    return requests.fetch(url,policy,maximum);
  }
  private void storeMedia(SourcePolicy policy, BatchStore store, UUID run, UUID item, JsonNode image) {
    storeAsset(policy, store, run, item, image.path("position").asInt(), "IMAGE", image.path("remoteUrl").asText(), true);
  }
  private void storeAttachment(SourcePolicy policy, BatchStore store, UUID run, UUID item, JsonNode attachment, int offset) {
    storeAsset(policy, store, run, item, offset + attachment.path("position").asInt(), "FILE", attachment.path("remoteUrl").asText(), false);
  }
  private void storeAsset(SourcePolicy policy, BatchStore store, UUID run, UUID item, int position, String kind, String remoteUrl, boolean requireImage) {
    URI remote = URI.create(remoteUrl);

    var response = fetchAsset(remote, policy.imagePolicy(remote.toString()));
    String contentType = requireImage ? SourceImageType.detect(response.bytes(), response.contentType()) : response.contentType();
    if (requireImage && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) throw new CollectorFailure(415, "SOURCE_NOT_IMAGE");
    String key = "collect/media/" + run + "/" + item + "/" + position;
    var object = objects.put(key, response.bytes(), contentType);
    store.media(item, position, kind, remote.toString(), object.objectKey(), object.sha256(), object.contentType(), object.bytes());
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
  private static String sns(JsonNode blocks) {
    var urls = new ArrayList<String>();
    for (var block : blocks)
      if ("LINK".equals(block.path("type").asText())
          && block.path("url").asText().matches("https://(x.com|twitter.com|www.instagram.com|www.youtube.com|youtu.be|www.tiktok.com)/.*"))
        urls.add(block.path("url").asText());
    return Json.tree(urls).toString();
  }
  private static String postKey(SourceRegistry.Source source, URI canonical) {
    if (SiteAdapters.supported(source.config().path("parser").asText())) return source.adapter().identify(canonical).postKey();
    if ("THEQOO".equals(source.config().path("parser").asText())) {
      var matcher = Pattern.compile("^/[A-Za-z0-9_/-]*?([0-9]{3,})/?$").matcher(canonical.getPath());
      if (matcher.matches()) return matcher.group(1);
    }
    return objectName(canonical.toString());
  }
  private static String objectName(String value) {
    String slug = value.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
    if (slug.isBlank()) slug = "post";
    if (slug.length() > 80) slug = slug.substring(0, 80);
    try {
      var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return slug + "-" + BatchObjectStore.hex(digest).substring(0, 12);
    } catch (Exception e) { throw new IllegalStateException(e); }
  }
  private void pause(long millis) { if (millis > 0) sleeper.accept(millis); }
  private static void sleep(long millis) {
    try { Thread.sleep(millis); }
    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new CollectorFailure(503, "BATCH_INTERRUPTED"); }
  }
}
