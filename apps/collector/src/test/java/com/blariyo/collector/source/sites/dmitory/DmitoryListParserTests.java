package com.blariyo.collector.source.sites.dmitory;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class DmitoryListParserTests extends ListParserContract {
  DmitoryListParserTests() { super("dmitory"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new DmitoryListParser(new DmitoryAdapter()).parse(html, url);
  }
}
