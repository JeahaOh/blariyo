package com.blariyo.collector.source.sites.etoland;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.regex.Pattern;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.query;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class EtolandAdapter extends AbstractSiteAdapter {
  private final EtolandListParser listParser = new EtolandListParser(this);
  private final EtolandDetailParser detailParser = new EtolandDetailParser(this);

  protected String host() { return "etoland.co.kr"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String table = q.getOrDefault("bo_table", ""), id = q.getOrDefault("wr_id", "");
    if ("/bbs/board.php".equals(u.getPath()) && table.matches("[A-Za-z0-9_]+") && id.matches("[0-9]+"))
      return identity("/bbs/board.php?bo_table=" + table + "&wr_id=" + id, table + ":" + id);
    var pretty = Pattern.compile("^/b/([A-Za-z0-9_]+)/view/.+-([0-9]+)$").matcher(u.getPath());
    if (pretty.matches()) return identity(u.getPath(), pretty.group(1) + ":" + pretty.group(2));
    throw invalid();
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
