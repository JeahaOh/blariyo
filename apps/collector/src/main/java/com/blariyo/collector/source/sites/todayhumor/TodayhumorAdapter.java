package com.blariyo.collector.source.sites.todayhumor;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.query;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class TodayhumorAdapter extends AbstractSiteAdapter {
  private final TodayhumorListParser listParser = new TodayhumorListParser(this);
  private final TodayhumorDetailParser detailParser = new TodayhumorDetailParser(this);

  protected String host() { return "www.todayhumor.co.kr"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String table = q.getOrDefault("table", ""), id = q.getOrDefault("no", "");
    if (!"/board/view.php".equals(u.getPath()) || !table.matches("[a-zA-Z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
    return identity("/board/view.php?table=" + table + "&no=" + id, table + ":" + id);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
