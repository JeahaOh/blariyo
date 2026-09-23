package com.blariyo.collector.source.sites.todayhumor;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class TodayhumorDetailParserTests extends DetailParserContract {
  TodayhumorDetailParserTests() { super("todayhumor", "#viewContent, .viewContent"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new TodayhumorDetailParser(new TodayhumorAdapter()).parse(html, url, policy);
  }
}
