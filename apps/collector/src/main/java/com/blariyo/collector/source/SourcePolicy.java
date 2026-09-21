package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.util.*;
import org.jsoup.Jsoup;
import tools.jackson.databind.JsonNode;

public record SourcePolicy(
    String host,
    List<String> pathPrefixes,
    String titleSelector,
    String imageSelector,
    String userAgent,
    String parser,
    Map<String, List<String>> imageOrigins) {
  public SourcePolicy(String host, List<String> paths, String title, String image, String agent) {
    this(host, paths, title, image, agent, "METADATA", Map.of());
  }

  public static SourcePolicy from(JsonNode config) {
    if (!config.path("approved").asBoolean(false))
      throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
    var paths = new ArrayList<String>();
    config.path("pathPrefixes").forEach(v -> paths.add(v.asText()));
    String agent = config.path("userAgent").asText();
    String parser = config.path("parser").asText("METADATA");
    if (paths.isEmpty() || agent.isBlank() || !agent.contains("contact")
        || !Set.of("METADATA", "THEQOO").contains(parser))
      throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    var origins = new LinkedHashMap<String, List<String>>();
    for (var item : config.path("imageOrigins").properties()) {
      URI origin = URI.create(item.getKey());
      if (!"https".equals(origin.getScheme()) || origin.getHost() == null
          || origin.getPort() != -1 || origin.getUserInfo() != null || origin.getQuery() != null
          || origin.getFragment() != null || !origin.getPath().isEmpty())
        throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
      var prefixes = new ArrayList<String>();
      item.getValue().forEach(v -> prefixes.add(v.asText()));
      if (prefixes.isEmpty() || prefixes.stream().anyMatch(p -> !p.startsWith("/")))
        throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
      origins.put(origin.getHost(), List.copyOf(prefixes));
    }
    return new SourcePolicy(config.path("host").asText(), paths,
        config.path("titleSelector").asText(), config.path("imageSelector").asText(),
        agent, parser, Map.copyOf(origins));
  }

  /** Images have a separate exact-origin allowlist; detail fetch never inherits it. */
  public SourcePolicy imagePolicy(String value) {
    try {
      URI uri = URI.create(value);
      var paths = imageOrigins.get(uri.getHost());
      var policy = paths == null ? this : new SourcePolicy(uri.getHost(), paths, "", "", userAgent);
      policy.allow(value);
      return policy;
    } catch (CollectorFailure e) { throw e; }
    catch (Exception e) { throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED"); }
  }
  public URI allow(String value) {
    try {
      URI uri = URI.create(value);
      if (!"https".equals(uri.getScheme())
          || !host.equalsIgnoreCase(uri.getHost())
          || uri.getUserInfo() != null
          || uri.getPort() != -1
          || uri.getFragment() != null
          || pathPrefixes.stream().noneMatch(p -> uri.getPath().startsWith(p))
          || uri.getPath().contains("..")) throw new IllegalArgumentException();
      return uri;
    } catch (Exception e) {
      throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
    }
  }

  public JsonNode extract(byte[] html, URI uri) {
    if (parser.equals("THEQOO")) return new TheqooParser(this).extract(html, uri);
    try {
      var document = Jsoup.parse(new java.io.ByteArrayInputStream(html), null, uri.toString());
      var title = document.selectFirst(titleSelector);
      if (title == null) throw new CollectorFailure(422, "PARSE_FAILED");
      String text = title.hasAttr("content") ? title.attr("content").strip() : title.text().strip();
      if (text.isBlank()) throw new CollectorFailure(422, "PARSE_FAILED");
      if (text.codePointCount(0, text.length()) > 300)
        text = text.substring(0, text.offsetByCodePoints(0, 300));
      var images = new ArrayList<Map<String, Object>>();
      var seen = new HashSet<String>();
      for (var element : document.select(imageSelector)) {
        String value = element.absUrl("src");
        if (value.isBlank()) value = element.absUrl("data-src");
        if (value.isBlank()) value = element.attr("content");
        if (value.isBlank()) continue;
        // Image URLs use the separate exact-origin allowlist. This lets a source
        // page and its approved CDN have different path prefixes.
        URI image = imagePolicy(value).allow(value);
        if (seen.add(image.toString()))
          images.add(Map.of("position", images.size() + 1, "remoteUrl", image.toString()));
        if (images.size() == 20) break;
      }
      if (images.isEmpty()) throw new CollectorFailure(422, "PARSE_FAILED");
      var result = new LinkedHashMap<String, Object>();
      result.put("status", "NEW");
      result.put("title", text);
      result.put("canonicalUrl", uri.toString());
      result.put("sourcePublishedAt", null);
      result.put("parserVersion", "jsoup-1.23.2-v1");
      result.put("warnings", List.of());
      result.put("imageCandidates", images);
      return Json.tree(result);
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(422, "PARSE_FAILED");
    }
  }

  /** Conservative robots handling: a potentially applicable disallow blocks the fetch. */
  public boolean robotsAllows(String text, URI uri) {
    boolean applies = false, directives = false;
    for (String raw : text.split("\\R")) {
      String line = raw.split("#", 2)[0].strip();
      int colon = line.indexOf(':');
      if (colon < 0) continue;
      String name = line.substring(0, colon).strip().toLowerCase(Locale.ROOT),
          value = line.substring(colon + 1).strip();
      if (name.equals("user-agent")) {
        if (directives) {
          applies = false;
          directives = false;
        }
        applies |=
            value.equals("*")
                || !value.isBlank()
                    && userAgent
                        .toLowerCase(Locale.ROOT)
                        .startsWith(value.toLowerCase(Locale.ROOT));
        continue;
      }
      if (name.equals("disallow") || name.equals("allow")) directives = true;
      if (applies && name.equals("disallow") && !value.isBlank()) {
        String prefix = value.split("\\*", 2)[0].replace("$", "");
        if (uri.getRawPath().startsWith(prefix)) return false;
      }
    }
    return true;
  }
}
