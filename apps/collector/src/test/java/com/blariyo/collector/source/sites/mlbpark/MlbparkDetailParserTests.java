package com.blariyo.collector.source.sites.mlbpark;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class MlbparkDetailParserTests extends DetailParserContract {
  MlbparkDetailParserTests() { super("mlbpark", "#contentDetail"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new MlbparkDetailParser(new MlbparkAdapter()).parse(html, url, policy);
  }
}
