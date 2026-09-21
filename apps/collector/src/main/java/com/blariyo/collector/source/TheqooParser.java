package com.blariyo.collector.source;

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
