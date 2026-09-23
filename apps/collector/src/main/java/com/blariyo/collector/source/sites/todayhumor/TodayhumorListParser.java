package com.blariyo.collector.source.sites.todayhumor;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Todayhumor. */
public final class TodayhumorListParser extends HtmlListParser {
  public TodayhumorListParser(TodayhumorAdapter adapter) { super(adapter); }

  protected String links() { return "a[href*=/board/view.php][href*=table][href*=no]"; }

  protected String row() { return "tr, .view"; }

  protected String pageParameter() { return "page"; }
}
