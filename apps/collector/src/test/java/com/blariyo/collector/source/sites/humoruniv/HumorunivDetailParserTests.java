package com.blariyo.collector.source.sites.humoruniv;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class HumorunivDetailParserTests extends DetailParserContract {
  HumorunivDetailParserTests() { super("humoruniv", ".daum-wm-content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new HumorunivDetailParser(new HumorunivAdapter()).parse(html, url, policy);
  }
  @Override protected String body(String html) { return "<p class='content_body_padding'></p>" + html; }
}
