package com.blariyo.collector.source.sites.youtubecommunity;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.HtmlDetailParser;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import tools.jackson.databind.JsonNode;

/** Offline ordered detail parsing for YoutubeCommunity. */
public final class YoutubeCommunityDetailParser extends HtmlDetailParser {
  public YoutubeCommunityDetailParser(YoutubeCommunityAdapter adapter) {
    super(adapter, "youtubecommunity-ordered-v1");
  }

  protected String body() { return "ytd-backstage-post-renderer #content-text, yt-formatted-string#content-text, #content-text, article .content"; }

  protected String dateSelector() { return "time[datetime], #published-time-text"; }

  @Override public JsonNode parse(byte[] bytes, URI url, SourcePolicy policy) {
    try { return super.parse(bytes, url, policy); }
    catch (CollectorFailure e) {
      if (!"PARSE_FAILED".equals(e.getMessage())) throw e;
      return fromInitialData(bytes, url, policy);
    }
  }

  private JsonNode fromInitialData(byte[] bytes, URI url, SourcePolicy policy) {
    Identity requested = identify(url);
    Document doc = parseHtml(bytes, url);
    var titleEl = doc.selectFirst("meta[property=og:title], title");
    String title = titleEl == null ? "YouTube community post" : titleEl.hasAttr("content") ? titleEl.attr("content") : titleEl.text();
    title = title.strip();
    if (title.isBlank() || title.codePointCount(0, title.length()) > 300) throw new CollectorFailure(422, "PARSE_FAILED");
    for (var script : doc.select("script")) {
      String data = script.data();
      int start = data.indexOf("var ytInitialData = ");
      if (start < 0) continue;
      start += "var ytInitialData = ".length();
      int end = data.indexOf(";</script>", start);
      if (end < 0) end = data.lastIndexOf(';');
      if (end <= start) continue;
      try {
        JsonNode root = Json.parse(data.substring(start, end).getBytes(StandardCharsets.UTF_8));
        var posts = new ArrayList<JsonNode>(); collectNamed(root, "backstagePostRenderer", posts);
        for (var post : posts) {
          String text = runsText(post.path("contentText"));
          var images = new ArrayList<Map<String, Object>>();
          var blocks = new ArrayList<Map<String, Object>>();
          if (!text.isBlank()) blocks.add(Map.of("type", "TEXT", "text", text));
          var thumbnails = new ArrayList<String>(); collectThumbnailUrls(post, thumbnails);
          var seen = new LinkedHashSet<String>();
          for (String remote : thumbnails) {
            if (!seen.add(remote)) continue;
            policy.imagePolicy(remote).allow(remote);
            int position = images.size() + 1;
            images.add(Map.of("position", position, "remoteUrl", remote));
            blocks.add(Map.of("type", "IMAGE", "imagePosition", position, "alt", ""));
            if (images.size() > policy.mediaLimits().maxImages()) throw new CollectorFailure(422, "SOURCE_IMAGE_LIMIT_EXCEEDED");
          }
          if (blocks.isEmpty()) continue;
          var result = new LinkedHashMap<String, Object>();
          result.put("status", "NEW");
          result.put("title", title);
          result.put("canonicalUrl", requested.canonical().toString());
          result.put("sourcePublishedAt", null);
          result.put("parserVersion", "youtube-community-ytinitialdata-v1");
          result.put("warnings", List.of());
          result.put("imageCandidates", images);
          result.put("attachmentCandidates", List.of());
          result.put("contentBlocks", blocks);
          return Json.tree(result);
        }
      } catch (CollectorFailure ex) { throw ex; }
      catch (Exception ignored) { }
    }
    throw new CollectorFailure(422, "PARSE_FAILED");
  }

  private static void collectNamed(JsonNode node, String name, List<JsonNode> out) {
    if (node == null || node.isNull()) return;
    if (node.isObject()) {
      for (var entry : node.properties()) {
        if (entry.getKey().equals(name)) out.add(entry.getValue());
        collectNamed(entry.getValue(), name, out);
      }
    } else if (node.isArray()) for (var child : node) collectNamed(child, name, out);
  }

  private static String runsText(JsonNode node) {
    if (node.isMissingNode() || node.isNull()) return "";
    var out = new StringBuilder();
    if (!node.path("simpleText").asText("").isBlank()) out.append(node.path("simpleText").asText());
    for (var run : node.path("runs")) out.append(run.path("text").asText(""));
    return out.toString().strip();
  }

  private static void collectThumbnailUrls(JsonNode node, List<String> out) {
    if (node == null || node.isNull()) return;
    if (node.isObject()) {
      String url = node.path("url").asText("");
      if (url.startsWith("https://i.ytimg.com/") || url.startsWith("https://yt3.ggpht.com/")) out.add(url);
      for (var entry : node.properties()) collectThumbnailUrls(entry.getValue(), out);
    } else if (node.isArray()) for (var child : node) collectThumbnailUrls(child, out);
  }
}
