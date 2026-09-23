package com.blariyo.collector.source.sites.inven;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class InvenListParserTests extends ListParserContract {
  InvenListParserTests() { super("inven"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new InvenListParser(new InvenAdapter()).parse(html, url);
  }
}
