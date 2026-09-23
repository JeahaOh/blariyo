package com.blariyo.collector.source.sites.ppomppu;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class PpomppuDetailParserTests extends DetailParserContract {
  PpomppuDetailParserTests() { super("ppomppu", ".board-contents"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new PpomppuDetailParser(new PpomppuAdapter()).parse(html, url, policy);
  }
}
