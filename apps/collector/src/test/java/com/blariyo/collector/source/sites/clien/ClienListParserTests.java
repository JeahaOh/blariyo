package com.blariyo.collector.source.sites.clien;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class ClienListParserTests extends ListParserContract {
  ClienListParserTests() { super("clien"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new ClienListParser(new ClienAdapter()).parse(html, url);
  }
}
