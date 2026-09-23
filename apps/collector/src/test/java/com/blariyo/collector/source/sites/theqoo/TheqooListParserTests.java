package com.blariyo.collector.source.sites.theqoo;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class TheqooListParserTests extends ListParserContract {
  TheqooListParserTests() { super("theqoo"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new TheqooListParser(new TheqooAdapter()).parse(html, url);
  }
}
