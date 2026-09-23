package com.blariyo.collector.source.sites.bobaedream;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Bobaedream. */
public final class BobaedreamListParser extends HtmlListParser {
  public BobaedreamListParser(BobaedreamAdapter adapter) { super(adapter); }

  protected String links() { return "a.bsubject[href]"; }

  protected String row() { return "tr"; }

  protected String pageParameter() { return "page"; }
}
