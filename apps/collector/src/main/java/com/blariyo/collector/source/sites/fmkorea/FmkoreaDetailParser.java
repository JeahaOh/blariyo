package com.blariyo.collector.source.sites.fmkorea;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Fmkorea. */
public final class FmkoreaDetailParser extends HtmlDetailParser {
  public FmkoreaDetailParser(FmkoreaAdapter adapter) {
    super(adapter, "fmkorea-ordered-v1");
  }

  protected String body() { return ".xe_content, .rd_body, article .content, .document-content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
