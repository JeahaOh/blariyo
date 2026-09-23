package com.blariyo.collector.source.sites.etoland;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Etoland. */
public final class EtolandDetailParser extends HtmlDetailParser {
  public EtolandDetailParser(EtolandAdapter adapter) {
    super(adapter, "etoland-ordered-v1");
  }

  protected String body() { return "#bo_v_con, .view-content, .view_content, .board_view .content, .view-wrap .content, article .content"; }

  protected String dateSelector() { return "time[datetime], .if_date, .date"; }
}
