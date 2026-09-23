package com.blariyo.collector.source.common;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SourcePolicy;
import java.net.URI;
import java.time.Instant;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.instant;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Shared ordered detail extraction with an explicit, stable parser version. */
public abstract class HtmlDetailParser extends SiteParsingContext {
  private final String parserVersion;

  protected HtmlDetailParser(AbstractSiteAdapter adapter, String parserVersion) {
    super(adapter);
    this.parserVersion = parserVersion;
  }
  protected abstract String body();
  protected abstract String dateSelector();
  protected String titleSelector() { return "meta[property=og:title],title"; }
  protected int maxBlocks() { return 1000; }

  public JsonNode parse(byte[] bytes, URI url, SourcePolicy policy) {
    Identity requested = identify(url);
    Document doc = parseHtml(bytes, url);
    Identity canonical = requested;
    var link = doc.selectFirst("link[rel=canonical][href]");
    if (link != null) {
      canonical = identify(url.resolve(link.attr("href")));
      if (!canonical.postKey().equals(requested.postKey())) throw invalid();
    }
    ObjectNode result = (ObjectNode) new OrderedContentParser(policy, maxBlocks(), policy.mediaLimits().maxImages()).extract(bytes, url,
        body(), titleSelector(), parserVersion);
    result.put("canonicalUrl", canonical.canonical().toString());
    var date = doc.selectFirst(dateSelector());
    if (date != null) {
      Instant published = instant(date.hasAttr("datetime") ? date.attr("datetime") : date.text());
      if (published != null) result.put("sourcePublishedAt", published.toString());
    }
    return result;
  }
}
