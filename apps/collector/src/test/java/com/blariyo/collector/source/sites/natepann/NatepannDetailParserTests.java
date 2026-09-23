package com.blariyo.collector.source.sites.natepann;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class NatepannDetailParserTests extends DetailParserContract {
  NatepannDetailParserTests() { super("natepann", "#contentArea"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new NatepannDetailParser(new NatepannAdapter()).parse(html, url, policy);
  }
}
