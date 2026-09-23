package com.blariyo.collector.source.sites.mlbpark;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class MlbparkListParserTests extends ListParserContract {
  MlbparkListParserTests() { super("mlbpark"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new MlbparkListParser(new MlbparkAdapter()).parse(html, url);
  }
}
