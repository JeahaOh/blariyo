package com.blariyo.collector.source.sites.dogdrip;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Dogdrip. */
public final class DogdripDetailParser extends HtmlDetailParser {
  public DogdripDetailParser(DogdripAdapter adapter) {
    super(adapter, "dogdrip-ordered-v1");
  }

  protected String body() { return "div[class~=document_[0-9]+_0].xe_content"; }

  protected String dateSelector() { return ".article-head time[datetime]"; }
}
