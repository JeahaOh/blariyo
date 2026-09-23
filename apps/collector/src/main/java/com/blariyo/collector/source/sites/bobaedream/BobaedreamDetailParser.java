package com.blariyo.collector.source.sites.bobaedream;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Bobaedream. */
public final class BobaedreamDetailParser extends HtmlDetailParser {
  public BobaedreamDetailParser(BobaedreamAdapter adapter) {
    super(adapter, "bobaedream-ordered-v1");
  }

  protected String body() { return ".bodyCont[itemprop=articleBody]"; }

  protected String dateSelector() { return ".writerInfo03 .date"; }

  protected int maxBlocks() { return 1000; }
}
