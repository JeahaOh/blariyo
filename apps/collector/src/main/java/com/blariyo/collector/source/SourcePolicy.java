package com.blariyo.collector.source;

import com.blariyo.collector.source.sites.theqoo.TheqooParser;
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
    Map<String, List<String>> imageOrigins,
    List<String> hostAliases,
    SourceMediaLimits mediaLimits,
    boolean publicImage) {
  public SourcePolicy(String host, List<String> paths, String title, String image, String agent, String parser,
      Map<String, List<String>> origins, List<String> aliases, SourceMediaLimits limits) {
    this(host, paths, title, image, agent, parser, origins, aliases, limits, false);
  }
  public SourcePolicy(String host, List<String> paths, String title, String image, String agent, String parser, Map<String, List<String>> imageOrigins, List<String> aliases) {
    this(host, paths, title, image, agent, parser, imageOrigins, aliases, SourceMediaLimits.DEFAULT);
  }
  public SourcePolicy(String host, List<String> paths, String title, String image, String agent) {
    this(host, paths, title, image, agent, "METADATA", Map.of(), List.of());
  }
  public SourcePolicy(String host, List<String> paths, String title, String image, String agent, String parser, Map<String, List<String>> imageOrigins) {
    this(host, paths, title, image, agent, parser, imageOrigins, List.of());
  }

  public static SourcePolicy from(JsonNode config) {
    if (!config.path("approved").asBoolean(false))
      throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED").diagnostic("UNAPPROVED_SOURCE", null, null);
    if (!config.path("blockedReason").asText("").isBlank())
      throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED").diagnostic("CONFIG_BLOCKED", null, null);
    var paths = new ArrayList<String>();
    config.path("pathPrefixes").forEach(v -> paths.add(v.asText()));
    String agent = config.path("userAgent").asText();
    String parser = config.path("parser").asText("METADATA");
    if (paths.isEmpty() || paths.stream().anyMatch(p -> !p.startsWith("/")) || agent.isBlank() || agent.contains("미정") || !agent.contains("contact")
        || !(Set.of("METADATA", "THEQOO").contains(parser) || SiteAdapters.supported(parser)))
      throw new CollectorFailure(503, "SOURCE_CONFIG_REQUIRED");
    var aliases = new ArrayList<String>();
    config.path("hostAliases").forEach(v -> aliases.add(v.asText()));
    if (aliases.stream().anyMatch(a -> a.isBlank() || a.contains("/") || a.contains(":")))
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
        agent, parser, Map.copyOf(origins), List.copyOf(aliases), SourceMediaLimits.from(config.path("mediaLimits")));
  }

  /** Public images are independent of the article's host. DNS/IP checks still precede every socket. */
  public SourcePolicy imagePolicy(String value) {
    var policy = new SourcePolicy(host, List.of("/"), "", "", userAgent, parser,
        Map.of(), List.of(), mediaLimits, true);
    policy.allow(value);
    return policy;
  }

  /** Non-image attachments retain the existing exact-origin policy. */
  public SourcePolicy attachmentPolicy(String value) {
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
      if (publicImage) return allowImage(uri);
      if (!"https".equals(uri.getScheme())) throw denied("SCHEME_NOT_ALLOWED", uri);
      if (!(host.equalsIgnoreCase(uri.getHost()) || hostAliases.stream().anyMatch(a -> a.equalsIgnoreCase(uri.getHost())))) throw denied("HOST_NOT_ALLOWED", uri);
      if (uri.getUserInfo() != null) throw denied("URL_CREDENTIALS_NOT_ALLOWED", uri);
      if (uri.getPort() != -1) throw denied("PORT_NOT_ALLOWED", uri);
      if (uri.getFragment() != null) throw denied("URL_FRAGMENT_NOT_ALLOWED", uri);
      if (pathPrefixes.stream().noneMatch(p -> uri.getPath().startsWith(p)) || uri.getPath().contains("..")) throw denied("PATH_NOT_ALLOWED", uri);
      return uri;
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(403, publicImage ? "IMAGE_URL_NOT_ALLOWED" : "SOURCE_NOT_ALLOWED").diagnostic("INVALID_URL", null, null);
    }
  }

  private static CollectorFailure denied(String reason, URI uri) {
    return new CollectorFailure(403,"SOURCE_NOT_ALLOWED").diagnostic(reason,uri,null);
  }

  private static URI allowImage(URI uri) throws java.net.UnknownHostException {
    String scheme = uri.getScheme(), target = uri.getHost();
    if (!("http".equals(scheme) || "https".equals(scheme))) throw imageDenied("SCHEME_NOT_ALLOWED",uri);
    if (target == null || uri.toString().length() > 2048) throw imageDenied("INVALID_URL",uri);
    if (uri.getUserInfo() != null) throw imageDenied("URL_CREDENTIALS_NOT_ALLOWED",uri);
    if (uri.getFragment() != null) throw imageDenied("URL_FRAGMENT_NOT_ALLOWED",uri);
    if (uri.getPort() != -1 && uri.getPort() != (scheme.equals("http") ? 80 : 443)) throw imageDenied("PORT_NOT_ALLOWED",uri);
    if (uri.getPath().contains("..")) throw imageDenied("PATH_NOT_ALLOWED",uri);
    // Literal IPs can be rejected without DNS or opening a socket. Hostnames are checked by PinnedHttp.
    if ((target.contains(":") || target.matches("[0-9.]+"))
        && !PinnedHttp.publicAddress(java.net.InetAddress.getByName(target))) throw imageDenied("NON_PUBLIC_IP",uri);
    if (target.equalsIgnoreCase("localhost") || target.toLowerCase(Locale.ROOT).endsWith(".localhost"))
      throw imageDenied("NON_PUBLIC_IP",uri);
    return uri;
  }
  private static CollectorFailure imageDenied(String reason,URI uri) {
    return new CollectorFailure(403,"IMAGE_URL_NOT_ALLOWED").diagnostic(reason,uri,null);
  }

  public JsonNode extract(byte[] html, URI uri) {
    if (SiteAdapters.supported(parser)) return SiteAdapters.require(parser).detail(html, uri, this);
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

  /** Reference-only robots interpretation; collection does not use this as a fetch gate. */
  public boolean robotsAllows(String text, URI uri) {
    return new RobotsRules(text).allows(userAgent, uri);
  }
}
