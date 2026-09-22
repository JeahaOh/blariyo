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
    UUID run = UUID.randomUUID();
    boolean runStarted = false;
    int fetched = 0, duplicates = 0, failures = 0;
    var errors = new ArrayList<String>();
    var failureDetail = new LinkedHashMap<String, Object>();
    try {
      var policy = source.policy();
      URI detail = policy.allow(source.canonical(options.url()));
      failureDetail.put("detailUrl", detail.toString());
      String postKey = postKey(source, detail);
      failureDetail.put("sourcePostKey", postKey);
      if (options.writeDb()) {
        run = store.begin(source.key(), "manual", "WRITE_DB", 1, 1, options.intervalMs(), null);
        runStarted = true;
      }
      pause(options.intervalMs());
      byte[] html = fetchBytes(detail, policy, 30 * 1024 * 1024);
      JsonNode result = policy.extract(html, detail);
      String canonical = result.path("canonicalUrl").asText(detail.toString());
      postKey = postKey(source, URI.create(canonical));
      failureDetail.put("sourcePostKey", postKey);
      failureDetail.put("canonicalUrl", canonical);
      String rawKey = "collect/raw/" + run + "/" + objectName(postKey) + ".html";
      if (options.writeDb()) {
        UUID item = store.item(run, source.key(), postKey, canonical, "FETCHING", result.path("title").asText(),
            result.path("contentBlocks").toString(), result.path("attachmentCandidates").toString(), sns(result.path("contentBlocks")), null);
        if (item == null) duplicates++;
        else {
          failureDetail.put("itemId", item.toString());
          try {
            var raw = objects.put(rawKey, html, "text/html");
            store.raw(item, raw.objectKey());
            for (var image : result.path("imageCandidates")) {
              try { storeMedia(policy, store, item, image); }
              catch (CollectorFailure e) { failureDetail.put("assetKind", "IMAGE"); failureDetail.put("assetUrl", image.path("remoteUrl").asText()); throw e; }
            }
            int offset = result.path("imageCandidates").size();
            for (var attachment : result.path("attachmentCandidates")) {
              try { storeAttachment(policy, store, item, attachment, offset); }
              catch (CollectorFailure e) { failureDetail.put("assetKind", "FILE"); failureDetail.put("assetUrl", attachment.path("remoteUrl").asText()); throw e; }
            }
            store.completeItem(item);
            fetched = 1;
          } catch (CollectorFailure e) {
            store.failItem(run, item, "DETAIL", e.getMessage(), failureDetail);
            throw e;
          }
        }
      } else fetched = 1;
      var report = new Report(run, source.key(), "COMPLETED", fetched, duplicates, failures, List.copyOf(errors));
      if (options.writeDb()) finish(run, report, Map.of("items", 1, "fetched", fetched));
      return report;
    } catch (CollectorFailure e) {
      failures++;
      errors.add(e.getMessage());
      var report = new Report(run, source.key(), runStarted ? "FAILED" : "BLOCKED", fetched, duplicates, failures, List.copyOf(errors));
      if (runStarted) {
        if (failures > 0 && !failureDetail.isEmpty() && !failureDetail.containsKey("itemId")) store.failItem(run, null, "DETAIL", e.getMessage(), failureDetail);
        finish(run, report, Map.of("items", 1, "fetched", fetched, "reason", e.getMessage()));
      }
      return report;
    }
  }

  private void finish(UUID run, Report report, Map<String, Object> checkpoint) {
    String reportKey = "collect/report/" + run + ".jsonl";
    objects.put(reportKey, (Json.tree(report).toString() + "\n").getBytes(StandardCharsets.UTF_8), "application/jsonl");
    store.finish(run, report.state(), checkpoint, reportKey);
  }
  private byte[] fetchBytes(URI url, SourcePolicy policy, int maximum) { return fetch(url, policy, maximum).bytes(); }
  private PinnedHttp.Response fetch(URI url, SourcePolicy policy, int maximum) {
    URI current = url;
    for (int redirects = 0; redirects < 5; redirects++) {
      policy.allow(current.toString());
      transport.validate(current);
      var response = transport.get(current, maximum, policy.userAgent());
      if (response.status() == 200) return response;
      if (response.status() >= 300 && response.status() < 400) {
        var location = response.headers().getOrDefault("location", List.of()).stream().findFirst().orElse("");
        if (!location.isBlank()) {
          current = policy.allow(current.resolve(location).toString());
          continue;
        }
      }
      throw new CollectorFailure(response.status() == 404 ? 404 : 403,
          response.status() == 404 ? "SOURCE_GONE" : "SOURCE_ACCESS_BLOCKED");
    }
    throw new CollectorFailure(403, "SOURCE_REDIRECT_LOOP");
  }
  private void storeMedia(SourcePolicy policy, BatchStore store, UUID item, JsonNode image) {
    storeAsset(policy, store, item, image.path("position").asInt(), "IMAGE", image.path("remoteUrl").asText(), true);
  }
  private void storeAttachment(SourcePolicy policy, BatchStore store, UUID item, JsonNode attachment, int offset) {
    storeAsset(policy, store, item, offset + attachment.path("position").asInt(), "FILE", attachment.path("remoteUrl").asText(), false);
  }
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
  private void storeAsset(SourcePolicy policy, BatchStore store, UUID item, int position, String kind, String remoteUrl, boolean requireImage) {
    URI remote = URI.create(remoteUrl);
    pause(1000);
    var response = fetch(remote, policy.imagePolicy(remote.toString()), 30 * 1024 * 1024);
    String contentType = requireImage ? detectedImageContentType(response.bytes(), response.contentType()) : response.contentType();
    if (requireImage && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) throw new CollectorFailure(415, "SOURCE_NOT_IMAGE");
    String key = "collect/media/" + item + "/" + position;
    var object = objects.put(key, response.bytes(), contentType);
    store.media(item, position, kind, remote.toString(), object.objectKey(), object.sha256(), object.contentType(), object.bytes());
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
