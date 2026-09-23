package com.blariyo.collector.source.sites.arcalive;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class ArcaliveDetailParserTests extends DetailParserContract {
  ArcaliveDetailParserTests() { super("arcalive", ".article-content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new ArcaliveDetailParser(new ArcaliveAdapter()).parse(html, url, policy);
  }
}
