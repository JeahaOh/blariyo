package com.blariyo.collector.source.sites.todayhumor;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Todayhumor. */
public final class TodayhumorDetailParser extends HtmlDetailParser {
  public TodayhumorDetailParser(TodayhumorAdapter adapter) {
    super(adapter, "todayhumor-ordered-v1");
  }

  protected String body() { return "#viewContent, .viewContent, .board_view .content"; }

  protected String dateSelector() { return "time[datetime], .writerInfoContents .date, .date"; }
}
