package com.blariyo.collector.source.sites.goodgag;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class GoodgagListParserTests extends ListParserContract {
  GoodgagListParserTests() { super("goodgag"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new GoodgagListParser(new GoodgagAdapter()).parse(html, url);
  }
}
