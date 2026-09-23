package com.blariyo.collector.source.sites.ppomppu;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class PpomppuListParserTests extends ListParserContract {
  PpomppuListParserTests() { super("ppomppu"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new PpomppuListParser(new PpomppuAdapter()).parse(html, url);
  }
}
