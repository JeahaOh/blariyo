package com.blariyo.collector.source.sites.natepann;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class NatepannListParserTests extends ListParserContract {
  NatepannListParserTests() { super("natepann"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new NatepannListParser(new NatepannAdapter()).parse(html, url);
  }
}
