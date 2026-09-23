package com.blariyo.collector.source.sites.theqoo;

import com.blariyo.collector.source.common.HtmlListParser;
import org.jsoup.nodes.Element;

/** Offline list parsing for Theqoo. */
public final class TheqooListParser extends HtmlListParser {
  public TheqooListParser(TheqooAdapter adapter) { super(adapter); }

  protected String links() { return "tbody.hide_notice tr:not(.notice) td.title > a[href^=/hot/], .theqoo_board_table tr:not(.notice) td.title > a[href^=/hot/], .bd_lst tr:not(.notice) td.title > a[href^=/hot/]"; }

  protected String row() { return "tr"; }

  protected String pageParameter() { return "page"; }

  protected boolean acceptListLink(Element a) {
    String text = a.text();
    return !text.contains("체험") && !text.contains("이벤트") && !text.contains("공지") && !text.contains("필독") && !text.contains("로그인 보안") && !text.contains("비밀번호") && !a.hasClass("replyNum");
  }
}
