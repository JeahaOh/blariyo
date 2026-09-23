package com.blariyo.collector.source.sites.dcinside;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class DcinsideListParserTests extends ListParserContract {
  DcinsideListParserTests() { super("dcinside"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new DcinsideListParser(new DcinsideAdapter()).parse(html, url);
  }
}
