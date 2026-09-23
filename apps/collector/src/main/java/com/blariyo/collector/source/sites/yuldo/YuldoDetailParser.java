package com.blariyo.collector.source.sites.yuldo;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Yuldo. */
public final class YuldoDetailParser extends HtmlDetailParser {
  public YuldoDetailParser(YuldoAdapter adapter) {
    super(adapter, "yuldo-ordered-v1");
  }

  protected String body() { return ".xe_content, .rd_body, article .content, .document-content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
