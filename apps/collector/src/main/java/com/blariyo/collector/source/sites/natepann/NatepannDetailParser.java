package com.blariyo.collector.source.sites.natepann;

import com.blariyo.collector.source.common.HtmlDetailParser;

/** Offline ordered detail parsing for Natepann. */
public final class NatepannDetailParser extends HtmlDetailParser {
  public NatepannDetailParser(NatepannAdapter adapter) {
    super(adapter, "natepann-ordered-v1");
  }

  protected String body() { return "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }

  protected int maxBlocks() { return 1000; }
}
