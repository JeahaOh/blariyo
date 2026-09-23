package com.blariyo.collector.source.sites.mlbpark;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.query;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class MlbparkAdapter extends AbstractSiteAdapter {
  private final MlbparkListParser listParser = new MlbparkListParser(this);
  private final MlbparkDetailParser detailParser = new MlbparkDetailParser(this);

  protected String host() { return "mlbpark.donga.com"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String board = q.getOrDefault("b", ""), id = q.getOrDefault("id", "");
    if (!"/mp/b.php".equals(u.getPath()) || !"view".equals(q.getOrDefault("m", "")) || !board.matches("[A-Za-z0-9_]+") || !id.matches("[A-Za-z0-9_-]+")) throw invalid();
    return identity("/mp/b.php?m=view&b=" + board + "&id=" + id, board + ":" + id);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
