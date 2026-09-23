package com.blariyo.collector.source.sites.dogdrip;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class DogdripListParserTests extends ListParserContract {
  DogdripListParserTests() { super("dogdrip"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new DogdripListParser(new DogdripAdapter()).parse(html, url);
  }
}
