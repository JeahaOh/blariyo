package com.blariyo.collector.source.sites.dcinside;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Dcinside. */
public final class DcinsideDetailParser extends HtmlDetailParser {
  public DcinsideDetailParser(DcinsideAdapter adapter) {
    super(adapter, "dcinside-ordered-v1");
  }

  protected String body() { return ".write_div, .writing_view_box .write_div, article .content"; }

  protected String dateSelector() { return "time[datetime], .gall_date, .date"; }
}
