package com.blariyo.collector.source.sites.ruliweb;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class RuliwebListParserTests extends ListParserContract {
  RuliwebListParserTests() { super("ruliweb"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new RuliwebListParser(new RuliwebAdapter()).parse(html, url);
  }
}
