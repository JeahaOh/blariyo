package com.blariyo.collector.source.sites.todayhumor;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class TodayhumorListParserTests extends ListParserContract {
  TodayhumorListParserTests() { super("todayhumor"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new TodayhumorListParser(new TodayhumorAdapter()).parse(html, url);
  }
}
