package com.blariyo.collector.source.sites.etoland;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class EtolandDetailParserTests extends DetailParserContract {
  EtolandDetailParserTests() { super("etoland", "#bo_v_con, .view-content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new EtolandDetailParser(new EtolandAdapter()).parse(html, url, policy);
  }
}
