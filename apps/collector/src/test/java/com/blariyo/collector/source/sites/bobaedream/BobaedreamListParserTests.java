package com.blariyo.collector.source.sites.bobaedream;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class BobaedreamListParserTests extends ListParserContract {
  BobaedreamListParserTests() { super("bobaedream"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new BobaedreamListParser(new BobaedreamAdapter()).parse(html, url);
  }
}
