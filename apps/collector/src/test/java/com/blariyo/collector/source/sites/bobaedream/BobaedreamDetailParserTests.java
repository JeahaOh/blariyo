package com.blariyo.collector.source.sites.bobaedream;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class BobaedreamDetailParserTests extends DetailParserContract {
  BobaedreamDetailParserTests() { super("bobaedream", ".bodyCont"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new BobaedreamDetailParser(new BobaedreamAdapter()).parse(html, url, policy);
  }
}
