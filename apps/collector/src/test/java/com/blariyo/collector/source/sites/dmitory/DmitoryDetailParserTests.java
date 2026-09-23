package com.blariyo.collector.source.sites.dmitory;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class DmitoryDetailParserTests extends DetailParserContract {
  DmitoryDetailParserTests() { super("dmitory", ".read_body .xe_content, #rd_body_content .xe_content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new DmitoryDetailParser(new DmitoryAdapter()).parse(html, url, policy);
  }
}
