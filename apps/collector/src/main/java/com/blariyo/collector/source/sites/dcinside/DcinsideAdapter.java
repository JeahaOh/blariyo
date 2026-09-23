package com.blariyo.collector.source.sites.dcinside;

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
public final class DcinsideAdapter extends AbstractSiteAdapter {
  private final DcinsideListParser listParser = new DcinsideListParser(this);
  private final DcinsideDetailParser detailParser = new DcinsideDetailParser(this);

  protected String host() { return "gall.dcinside.com"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String id = q.getOrDefault("id", ""), no = q.getOrDefault("no", "");
    if (!Set.of("/board/view/", "/mgallery/board/view/", "/mini/board/view/").contains(u.getPath())
        || !id.matches("[A-Za-z0-9_]+") || !no.matches("[0-9]+")) throw invalid();
    return identity(u.getPath() + "?id=" + id + "&no=" + no, id + ":" + no);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
