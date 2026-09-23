package com.blariyo.collector.source.sites.fmkorea;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class FmkoreaListParserTests extends ListParserContract {
  FmkoreaListParserTests() { super("fmkorea"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new FmkoreaListParser(new FmkoreaAdapter()).parse(html, url);
  }
}
