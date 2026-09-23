package com.blariyo.collector.source.sites.instiz;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class InstizDetailParserTests extends DetailParserContract {
  InstizDetailParserTests() { super("instiz", "#memo_content_1"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new InstizDetailParser(new InstizAdapter()).parse(html, url, policy);
  }
}
