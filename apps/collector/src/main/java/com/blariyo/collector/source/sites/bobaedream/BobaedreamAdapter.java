package com.blariyo.collector.source.sites.bobaedream;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.Set;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.query;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class BobaedreamAdapter extends AbstractSiteAdapter {
  private final BobaedreamListParser listParser = new BobaedreamListParser(this);
  private final BobaedreamDetailParser detailParser = new BobaedreamDetailParser(this);

  protected String host() { return "www.bobaedream.co.kr"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String board = q.getOrDefault("code", ""), id = q.getOrDefault("No", "");
    if (!Set.of("/view", "/board/bulletin/view.php").contains(u.getPath())
        || !board.matches("[a-zA-Z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
    return identity("/view?code=" + board + "&No=" + id, board + ":" + id);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
