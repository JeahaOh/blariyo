package com.blariyo.collector.source.sites.arcalive;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Arcalive. */
public final class ArcaliveListParser extends HtmlListParser {
  public ArcaliveListParser(ArcaliveAdapter adapter) { super(adapter); }

  protected String links() { return ".article-list a.title[href]"; }

  protected String row() { return ".vrow"; }

  protected String pageParameter() { return "p"; }
}
