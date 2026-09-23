package com.blariyo.collector.source.sites.humoruniv;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class HumorunivListParserTests extends ListParserContract {
  HumorunivListParserTests() { super("humoruniv"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new HumorunivListParser(new HumorunivAdapter()).parse(html, url);
  }
}
