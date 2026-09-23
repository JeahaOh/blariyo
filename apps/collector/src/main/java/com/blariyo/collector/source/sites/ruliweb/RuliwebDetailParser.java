package com.blariyo.collector.source.sites.ruliweb;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Ruliweb. */
public final class RuliwebDetailParser extends HtmlDetailParser {
  public RuliwebDetailParser(RuliwebAdapter adapter) {
    super(adapter, "ruliweb-ordered-v1");
  }

  protected String body() { return ".view_content[itemprop=articleBody], .view_content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }

  protected String titleSelector() { return ".subject_inner_text, meta[property=og:title],title"; }
}
