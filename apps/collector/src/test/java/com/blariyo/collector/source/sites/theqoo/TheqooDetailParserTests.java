package com.blariyo.collector.source.sites.theqoo;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class TheqooDetailParserTests extends DetailParserContract {
  TheqooDetailParserTests() { super("theqoo", "article[itemprop=articleBody]"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new TheqooDetailParser(new TheqooAdapter()).parse(html, url, policy);
  }
}
