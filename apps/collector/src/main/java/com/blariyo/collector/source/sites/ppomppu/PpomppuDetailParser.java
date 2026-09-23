package com.blariyo.collector.source.sites.ppomppu;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Ppomppu. */
public final class PpomppuDetailParser extends HtmlDetailParser {
  public PpomppuDetailParser(PpomppuAdapter adapter) {
    super(adapter, "ppomppu-ordered-v1");
  }

  protected String body() { return ".board-contents, td.board-contents, #quote, article .content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
