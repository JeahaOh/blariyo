package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Explicit rules observed in public HTML on 2026-09-21. Unobserved sites never fall back to OG. */
public final class SiteAdapters {
  private SiteAdapters() {}
  public static SiteAdapter require(String key) {
    return switch (key.toUpperCase(Locale.ROOT)) {
      case "ARCALIVE" -> new Arcalive();
      case "BOBAEDREAM" -> new Bobaedream();
      case "DOGDRIP" -> new Dogdrip();
      case "INVEN" -> new Inven();
      default -> throw new CollectorFailure(403, "SITE_PARSER_UNVERIFIED");
    };
  }
  public static boolean supported(String key) {
    return Set.of("ARCALIVE", "BOBAEDREAM", "DOGDRIP", "INVEN").contains(key.toUpperCase(Locale.ROOT));
  }
  private abstract static class HtmlSite implements SiteAdapter {
    abstract String host();
    abstract String body();
    abstract String links();
    abstract String row();
    abstract String pageParameter();
    abstract String dateSelector();
    void check(URI u) {
      if (!"https".equals(u.getScheme()) || !host().equalsIgnoreCase(u.getHost())
          || u.getUserInfo() != null || u.getPort() != -1 || u.getPath().contains("..")) throw invalid();
    }
    Identity identity(String path, String key) { return new Identity(URI.create("https://" + host() + path), key); }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
      var found = new LinkedHashMap<String, Entry>();
      for (var a : doc.select(links())) {
        var parent = a.closest(row());
        if (parent == null || parent.hasClass("notice") || parent.hasClass("notice-service")) continue;
        try {
          var id = identify(url.resolve(a.attr("href")));
          var date = parent.selectFirst("time[datetime]");
          Instant published = date == null ? null : instant(date.attr("datetime"));
          found.putIfAbsent(id.postKey(), new Entry(id, published));
        } catch (CollectorFailure ignored) { /* Navigation, unrelated board and adverts are not posts. */ }
      }
      if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
      URI next = null;
      int current = pageNumber(url);
      // Only observed links are followed. Never synthesize an unobserved next URL.
      for (var a : doc.select("a[href]")) {
        try {
          URI candidate = url.resolve(a.attr("href"));
          check(candidate);
          if (!candidate.getPath().equals(url.getPath()) || pageNumber(candidate) != current + 1) continue;
          var expected = query(url); expected.remove(pageParameter());
          var actual = query(candidate); actual.remove(pageParameter());
          if (actual.equals(expected)) { next = candidate; break; }
        } catch (IllegalArgumentException | CollectorFailure ignored) { }
      }
      return new Page(List.copyOf(found.values()), next);
    }
    private int pageNumber(URI url) {
      try { return Integer.parseInt(query(url).getOrDefault(pageParameter(), "1")); }
      catch (NumberFormatException e) { return -1; }
    }
    @Override public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      Identity requested = identify(url);
      Document doc = parse(bytes, url);
      Identity canonical = requested;
      var link = doc.selectFirst("link[rel=canonical][href]");
      if (link != null) {
        canonical = identify(url.resolve(link.attr("href")));
        if (!canonical.postKey().equals(requested.postKey())) throw invalid();
      }
      ObjectNode result = (ObjectNode) new OrderedContentParser(policy).extract(bytes, url,
          body(), "meta[property=og:title],title", getClass().getSimpleName().toLowerCase(Locale.ROOT) + "-ordered-v1");
      result.put("canonicalUrl", canonical.canonical().toString());
      var date = doc.selectFirst(dateSelector());
      if (date != null) {
        Instant published = instant(date.hasAttr("datetime") ? date.attr("datetime") : date.text());
        if (published != null) result.put("sourcePublishedAt", published.toString());
      }
      return result;
    }
  }
  private static final class Arcalive extends HtmlSite {
    String host() { return "arca.live"; }
    String body() { return ".article-view .article-content"; }
    String links() { return ".article-list a.title[href]"; }
    String row() { return ".vrow"; }
    String pageParameter() { return "p"; }
    String dateSelector() { return ".article-head time[datetime]"; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/b/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(2));
    }
  }
  private static final class Bobaedream extends HtmlSite {
    String host() { return "www.bobaedream.co.kr"; }
    String body() { return ".bodyCont[itemprop=articleBody]"; }
    String links() { return "a.bsubject[href]"; }
    String row() { return "tr"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return ".writerInfo03 .date"; }
    public Identity identify(URI u) {
      check(u); var q = query(u); String board = q.getOrDefault("code", ""), id = q.getOrDefault("No", "");
      if (!Set.of("/view", "/board/bulletin/view.php").contains(u.getPath())
          || !board.matches("[a-zA-Z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
      return identity("/view?code=" + board + "&No=" + id, board + ":" + id);
    }
  }
  private static final class Dogdrip extends HtmlSite {
    String host() { return "www.dogdrip.net"; }
    String body() { return "div[class~=document_[0-9]+_0].xe_content"; }
    String links() { return "a.title-link[href]"; }
    String row() { return "tr,li,.card"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return ".article-head time[datetime]"; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/(?:dogdrip/)?([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity("/" + m.group(1), m.group(1));
    }
  }
  private static final class Inven extends HtmlSite {
    String host() { return "www.inven.co.kr"; }
    String body() { return "#powerbbsContent"; }
    String links() { return "a.subject-link[href],.open-issue-gallery a.link[href]"; }
    String row() { return "tr"; }
    String pageParameter() { return "p"; }
    String dateSelector() { return ".articleInfo .articleDate"; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/board/([a-zA-Z0-9_]+)/([0-9]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1) + ":" + m.group(2) + ":" + m.group(3));
    }
  }
  private static Document parse(byte[] bytes, URI url) {
    try { return Jsoup.parse(new java.io.ByteArrayInputStream(bytes), null, url.toString()); }
    catch (Exception e) { throw new CollectorFailure(422, "PARSE_FAILED"); }
  }
  private static Instant instant(String text) {
    try { return Instant.parse(text); } catch (Exception ignored) { }
    try { return LocalDateTime.parse(text.strip(), java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm[:ss]")).atZone(ZoneId.of("Asia/Seoul")).toInstant(); }
    catch (Exception ignored) { return null; }
  }
  public static Map<String, String> query(URI u) {
    var result = new LinkedHashMap<String, String>();
    if (u.getRawQuery() == null) return result;
    for (String pair : u.getRawQuery().split("&")) {
      String[] values = pair.split("=", 2);
      String key = URLDecoder.decode(values[0], StandardCharsets.UTF_8);
      if (result.putIfAbsent(key, values.length == 1 ? "" : URLDecoder.decode(values[1], StandardCharsets.UTF_8)) != null) throw invalid();
    }
    return result;
  }
  private static CollectorFailure invalid() { return new CollectorFailure(403, "SOURCE_URL_INVALID"); }
}
