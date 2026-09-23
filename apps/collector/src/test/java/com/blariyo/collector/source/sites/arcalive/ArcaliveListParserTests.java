package com.blariyo.collector.source.sites.arcalive;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class ArcaliveListParserTests extends ListParserContract {
  ArcaliveListParserTests() { super("arcalive"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new ArcaliveListParser(new ArcaliveAdapter()).parse(html, url);
  }
}
