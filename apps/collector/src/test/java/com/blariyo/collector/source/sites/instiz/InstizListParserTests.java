package com.blariyo.collector.source.sites.instiz;

import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.common.ListParserContract;
import java.net.URI;

class InstizListParserTests extends ListParserContract {
  InstizListParserTests() { super("instiz"); }
  @Override protected SiteAdapter.Page parse(byte[] html, URI url) {
    return new InstizListParser(new InstizAdapter()).parse(html, url);
  }
}
