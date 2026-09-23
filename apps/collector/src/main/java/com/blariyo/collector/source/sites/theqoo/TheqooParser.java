package com.blariyo.collector.source.sites.theqoo;

import com.blariyo.collector.source.SourcePolicy;

import com.blariyo.collector.source.common.OrderedContentParser;
import com.blariyo.collector.source.common.OrderedContentParser;
import java.net.URI;
import tools.jackson.databind.JsonNode;

/** Theqoo article adapter; policy and live verification remain separate gates. */
public final class TheqooParser {
  private final SourcePolicy policy;
  public TheqooParser(SourcePolicy policy) { this.policy = policy; }
  public JsonNode extract(byte[] html, URI uri) {
    return new OrderedContentParser(policy).extract(html, uri,
        "article[itemprop=articleBody]", "meta[property=og:title],title", "theqoo-ordered-v1");
  }
}
