package com.blariyo.collector.source.sites.dmitory;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Dmitory. */
public final class DmitoryDetailParser extends HtmlDetailParser {
  public DmitoryDetailParser(DmitoryAdapter adapter) {
    super(adapter, "dmitory-ordered-v1");
  }

  protected String body() { return ".read_body .xe_content, #rd_body_content .xe_content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }

  protected int maxBlocks() { return 1000; }
}
