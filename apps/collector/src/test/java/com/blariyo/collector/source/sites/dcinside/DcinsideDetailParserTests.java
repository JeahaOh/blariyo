package com.blariyo.collector.source.sites.dcinside;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class DcinsideDetailParserTests extends DetailParserContract {
  DcinsideDetailParserTests() { super("dcinside", ".write_div"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new DcinsideDetailParser(new DcinsideAdapter()).parse(html, url, policy);
  }
}
