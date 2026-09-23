package com.blariyo.collector.source.sites.yuldo;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class YuldoListParserTests extends ListParserContract {
  YuldoListParserTests() { super("yuldo"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new YuldoListParser(new YuldoAdapter()).parse(html, url);
  }
}
