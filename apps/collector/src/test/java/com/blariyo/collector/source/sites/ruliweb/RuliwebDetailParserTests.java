package com.blariyo.collector.source.sites.ruliweb;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class RuliwebDetailParserTests extends DetailParserContract {
  RuliwebDetailParserTests() { super("ruliweb", ".view_content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new RuliwebDetailParser(new RuliwebAdapter()).parse(html, url, policy);
  }
}
