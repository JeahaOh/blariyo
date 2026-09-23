package com.blariyo.collector.source.sites.mlbpark;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Mlbpark. */
public final class MlbparkDetailParser extends HtmlDetailParser {
  public MlbparkDetailParser(MlbparkAdapter adapter) {
    super(adapter, "mlbpark-ordered-v1");
  }

  protected String body() { return "#contentDetail, .ar_txt, .view_content, article .content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
