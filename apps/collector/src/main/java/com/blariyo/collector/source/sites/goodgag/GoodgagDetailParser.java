package com.blariyo.collector.source.sites.goodgag;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Goodgag. */
public final class GoodgagDetailParser extends HtmlDetailParser {
  public GoodgagDetailParser(GoodgagAdapter adapter) {
    super(adapter, "goodgag-ordered-v1");
  }

  protected String body() { return ".content.issue, .xe_content, #bo_v_con, .view_content, article .content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
