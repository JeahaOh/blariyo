package com.blariyo.collector.source.sites.yuldo;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class YuldoDetailParserTests extends DetailParserContract {
  YuldoDetailParserTests() { super("yuldo", ".xe_content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new YuldoDetailParser(new YuldoAdapter()).parse(html, url, policy);
  }
}
