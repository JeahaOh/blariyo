package com.blariyo.collector.source.sites.clien;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class ClienDetailParserTests extends DetailParserContract {
  ClienDetailParserTests() { super("clien", ".post_article"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new ClienDetailParser(new ClienAdapter()).parse(html, url, policy);
  }
}
