package com.blariyo.collector.source.sites.theqoo;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.HtmlDetailParser;
import java.net.URI;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Offline ordered detail parsing for Theqoo. */
public final class TheqooDetailParser extends HtmlDetailParser {
  public TheqooDetailParser(TheqooAdapter adapter) {
    super(adapter, "theqoo-ordered-v1");
  }

  protected String body() { return "article[itemprop=articleBody]"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }

  @Override public JsonNode parse(byte[] bytes, URI url, SourcePolicy policy) {
    Identity requested = identify(url);
    ObjectNode result = (ObjectNode) new TheqooParser(policy).extract(bytes, url);
    result.put("canonicalUrl", requested.canonical().toString());
    return result;
  }
}
