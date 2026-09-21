package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.util.*;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import tools.jackson.databind.JsonNode;

/** An article-only, ordered parser. No summaries, HTML rendering or secondary SNS fetches. */
public final class OrderedContentParser {
  private static final Set<String> EXCLUDED = Set.of("script", "style", "noscript", "template");
  private static final Set<String> BOUNDARIES = Set.of("p", "div", "section", "article", "li", "blockquote", "pre", "h1", "h2", "h3", "tr");
  private static final Pattern URL = Pattern.compile("https?://[^\\s<>\"\\u200b]+");
  private final SourcePolicy policy;
  private final List<Map<String, Object>> blocks = new ArrayList<>(), images = new ArrayList<>();
  private final StringBuilder pending = new StringBuilder();
  private URI base;

  public OrderedContentParser(SourcePolicy policy) { this.policy = policy; }

  public JsonNode extract(byte[] html, URI uri, String bodySelector, String titleSelector, String version) {
    try {
      blocks.clear(); images.clear(); pending.setLength(0);
      base = uri;
      var document = Jsoup.parse(new java.io.ByteArrayInputStream(html), null, uri.toString());
      var articles = document.select(bodySelector);
      if (articles.size() != 1) throw failed();
      var og = document.selectFirst(titleSelector);
      String title = og == null ? "" : og.hasAttr("content") ? og.attr("content") : og.text();
      title = title.strip();
      if (title.isBlank() || length(title) > 300) throw failed();
      var article = articles.first().clone();
      article.select("script,style,noscript,template").remove();
      walk(article);
      flush();
      long expanded = blocks.stream().mapToLong(b -> b.get("type").equals("LINK")
          && !b.get("label").equals("") && !b.get("label").equals(b.get("url")) ? 2 : 1).sum();
      if (blocks.isEmpty() || expanded > 40 || images.size() > 20) throw failed();
      var result = new LinkedHashMap<String, Object>();
      result.put("status", "NEW");
      result.put("title", title);
      result.put("canonicalUrl", uri.toString());
      result.put("sourcePublishedAt", null);
      result.put("parserVersion", version);
      result.put("warnings", List.of());
      result.put("imageCandidates", images);
      result.put("contentBlocks", blocks);
      return Json.tree(result);
    } catch (CollectorFailure e) { throw e; }
    catch (Exception e) { throw failed(); }
  }

  private static int length(String text) { return text.codePointCount(0, text.length()); }
  private static CollectorFailure failed() { return new CollectorFailure(422, "PARSE_FAILED"); }
  private String url(String value) {
    if (value == null || value.isBlank()) throw failed();
    try {
      URI uri = base.resolve(value.strip());
      if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null
          || uri.getUserInfo() != null || length(uri.toString()) > 2048) throw failed();
      return uri.toString();
    } catch (IllegalArgumentException e) { throw failed(); }
  }
  private String attributeUrl(Element el, String... names) {
    for (String name : names) {
      String value = el.attr(name);
      if (!value.isBlank() && !value.startsWith("data:") && !value.startsWith("blob:")) return url(value);
    }
    throw failed();
  }
  private void add(Map<String, Object> block) {
    blocks.add(block);
    if (blocks.size() > 40) throw failed();
  }
  private void text(String value) {
    if (value.isBlank()) return;
    if (length(value) > 20000) throw failed();
    add(Map.of("type", "TEXT", "text", value));
  }
  private void link(String value, String label) {
    label = label.strip();
    if (length(label) > 300) throw failed();
    add(Map.of("type", "LINK", "url", url(value), "label", label));
  }
  private void flush() {
    String value = pending.toString().replace('\u00a0', ' ').replaceAll("[ \\t]+\\n", "\n").replaceAll("\\n{3,}", "\n\n").strip();
    pending.setLength(0);
    var matcher = URL.matcher(value);
    int cursor = 0;
    while (matcher.find()) {
      String reference = matcher.group().replaceAll("[),.!?]+$", "");
      text(value.substring(cursor, matcher.start()).strip());
      link(reference, "");
      cursor = matcher.start() + reference.length();
    }
    text(value.substring(cursor).strip());
  }
  private void walk(Node node) {
    if (node instanceof TextNode t) { pending.append(t.getWholeText()); return; }
    if (!(node instanceof Element el) || EXCLUDED.contains(el.normalName())) return;
    String tag = el.normalName();
    if (tag.equals("br")) { pending.append('\n'); return; }
    if (tag.equals("img")) {
      flush();
      String remote = attributeUrl(el, "data-original", "data-src", "data-lazy-src", "src");
      policy.imagePolicy(remote).allow(remote);
      String alt = el.attr("alt");
      if (length(alt) > 300 || images.size() == 20) throw failed();
      int position = images.size() + 1;
      images.add(Map.of("position", position, "remoteUrl", remote));
      add(Map.of("type", "IMAGE", "imagePosition", position, "alt", alt));
      return;
    }
    if (tag.equals("blockquote")) {
      String permalink = el.attr("data-instgrm-permalink");
      if (permalink.isBlank()) permalink = el.attr("cite");
      if (permalink.isBlank() && el.hasClass("twitter-tweet")) {
        var references = el.select("a[href*=/status/]");
        if (!references.isEmpty()) permalink = references.last().attr("href");
      }
      if (!permalink.isBlank()) { flush(); link(permalink, ""); return; }
    }
    if (tag.equals("iframe")) { flush(); link(attributeUrl(el, "src", "data-src"), ""); return; }
    if (tag.equals("video") || tag.equals("audio")) {
      flush();
      var sources = new LinkedHashSet<String>();
      if (!el.attr("src").isBlank()) sources.add(url(el.attr("src")));
      for (var source : el.select("source[src]")) sources.add(url(source.attr("src")));
      if (sources.isEmpty()) throw failed();
      sources.forEach(value -> link(value, ""));
      return;
    }
    if (tag.equals("a") && !el.attr("href").isBlank()) {
      if (el.attr("href").startsWith("#")) { for (var child : el.childNodes()) walk(child); return; }
      flush();
      // Preserve linked images and their accompanying caption, not just the thumbnail link.
      if (!el.select("img").isEmpty()) { for (var child : el.childNodes()) walk(child); }
      else link(el.attr("href"), el.text());
      return;
    }
    if (BOUNDARIES.contains(tag)) pending.append('\n');
    for (var child : el.childNodes()) walk(child);
    if (BOUNDARIES.contains(tag)) { pending.append('\n'); flush(); }
  }
}
