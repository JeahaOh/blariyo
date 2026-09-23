package com.blariyo.collector.source.sites.dmitory;

import com.blariyo.collector.source.common.HtmlListParser;

/** Offline list parsing for Dmitory. */
public final class DmitoryListParser extends HtmlListParser {
  public DmitoryListParser(DmitoryAdapter adapter) { super(adapter); }

  protected String links() { return "a.hx[href*=/issue/], a[href*=document_srl]"; }

  protected String row() { return "tr, li, .item"; }

  protected String pageParameter() { return "page"; }
}
