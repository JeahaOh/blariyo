package com.blariyo.collector.source.sites.arcalive;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Arcalive. */
public final class ArcaliveDetailParser extends HtmlDetailParser {
  public ArcaliveDetailParser(ArcaliveAdapter adapter) {
    super(adapter, "arcalive-ordered-v1");
  }

  protected String body() { return ".article-view .article-content"; }

  protected String dateSelector() { return ".article-head time[datetime]"; }

  protected int maxBlocks() { return 1000; }
}
