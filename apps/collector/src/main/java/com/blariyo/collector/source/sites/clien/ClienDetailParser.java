package com.blariyo.collector.source.sites.clien;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Clien. */
public final class ClienDetailParser extends HtmlDetailParser {
  public ClienDetailParser(ClienAdapter adapter) {
    super(adapter, "clien-ordered-v1");
  }

  protected String body() { return ".post_article, article .post-content, .board_read .content_view"; }

  protected String dateSelector() { return "time[datetime], .timestamp, .view_info .date"; }
}
