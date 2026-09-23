package com.blariyo.collector.source.sites.pgr21;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Pgr21. */
public final class Pgr21DetailParser extends HtmlDetailParser {
  public Pgr21DetailParser(Pgr21Adapter adapter) {
    super(adapter, "pgr21-ordered-v1");
  }

  protected String body() { return ".viewContent, .post_content, #view_content, article .content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
