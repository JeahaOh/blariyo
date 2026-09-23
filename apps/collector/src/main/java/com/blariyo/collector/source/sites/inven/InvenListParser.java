package com.blariyo.collector.source.sites.inven;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Inven. */
public final class InvenListParser extends HtmlListParser {
  public InvenListParser(InvenAdapter adapter) { super(adapter); }

  protected String links() { return "a.subject-link[href],.open-issue-gallery a.link[href]"; }

  protected String row() { return "tr"; }

  protected String pageParameter() { return "p"; }
}
