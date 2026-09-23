package com.blariyo.collector.source.sites.ruliweb;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Ruliweb. */
public final class RuliwebListParser extends HtmlListParser {
  public RuliwebListParser(RuliwebAdapter adapter) { super(adapter); }

  protected String links() { return "#best_body a.subject_link[href*=/read/], .board_list_table a.subject_link[href*=/read/]"; }

  protected String row() { return "tr"; }

  protected String pageParameter() { return "page"; }
}
