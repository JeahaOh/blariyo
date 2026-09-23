package com.blariyo.collector.source.sites.ppomppu;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.query;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class PpomppuAdapter extends AbstractSiteAdapter {
  private final PpomppuListParser listParser = new PpomppuListParser(this);
  private final PpomppuDetailParser detailParser = new PpomppuDetailParser(this);

  protected String host() { return "www.ppomppu.co.kr"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String id = q.getOrDefault("id", ""), no = q.getOrDefault("no", "");
    if (!"/zboard/view.php".equals(u.getPath()) || !id.matches("[A-Za-z0-9_]+") || !no.matches("[0-9]+")) throw invalid();
    return identity("/zboard/view.php?id=" + id + "&no=" + no, id + ":" + no);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
