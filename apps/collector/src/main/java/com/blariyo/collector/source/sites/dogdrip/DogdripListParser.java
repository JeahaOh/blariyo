package com.blariyo.collector.source.sites.dogdrip;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Dogdrip. */
public final class DogdripListParser extends HtmlListParser {
  public DogdripListParser(DogdripAdapter adapter) { super(adapter); }

  protected String links() { return "a.title-link[href]"; }

  protected String row() { return "tr,li,.card"; }

  protected String pageParameter() { return "page"; }
}
