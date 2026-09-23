package com.blariyo.collector.source.sites.etoland;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class EtolandListParserTests extends ListParserContract {
  EtolandListParserTests() { super("etoland"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new EtolandListParser(new EtolandAdapter()).parse(html, url);
  }
}
