package com.blariyo.collector.source.sites.inven;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class InvenDetailParserTests extends DetailParserContract {
  InvenDetailParserTests() { super("inven", "#powerbbsContent"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new InvenDetailParser(new InvenAdapter()).parse(html, url, policy);
  }
  @Override protected void prepare(org.jsoup.nodes.Document doc) { doc.select("#tbArticle > .articleFile").remove(); }
}
