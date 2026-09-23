package com.blariyo.collector.source.sites.fmkorea;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class FmkoreaDetailParserTests extends DetailParserContract {
  FmkoreaDetailParserTests() { super("fmkorea", ".xe_content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new FmkoreaDetailParser(new FmkoreaAdapter()).parse(html, url, policy);
  }
}
