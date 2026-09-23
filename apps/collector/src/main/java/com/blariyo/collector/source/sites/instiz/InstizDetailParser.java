package com.blariyo.collector.source.sites.instiz;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Instiz. */
public final class InstizDetailParser extends HtmlDetailParser {
  public InstizDetailParser(InstizAdapter adapter) {
    super(adapter, "instiz-ordered-v1");
  }

  protected String body() { return "#memo_content_1, .memo_content, .post_content, article .content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }
}
