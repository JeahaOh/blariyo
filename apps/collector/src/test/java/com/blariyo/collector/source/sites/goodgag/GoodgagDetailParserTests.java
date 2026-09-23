package com.blariyo.collector.source.sites.goodgag;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class GoodgagDetailParserTests extends DetailParserContract {
  GoodgagDetailParserTests() { super("goodgag", ".content.issue"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new GoodgagDetailParser(new GoodgagAdapter()).parse(html, url, policy);
  }
}
