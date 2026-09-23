package com.blariyo.collector.source.sites.goodgag;

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
public final class GoodgagAdapter extends AbstractSiteAdapter {
  private final GoodgagListParser listParser = new GoodgagListParser(this);
  private final GoodgagDetailParser detailParser = new GoodgagDetailParser(this);

  protected String host() { return "www.goodgag.net"; }

  public Identity identify(URI u) {
    check(u); var q = query(u); String document = q.getOrDefault("document_srl", q.getOrDefault("wr_id", ""));
    String board = q.getOrDefault("mid", q.getOrDefault("bo_table", "post"));
    if (("/bbs/board.php".equals(u.getPath()) || "/".equals(u.getPath())) && board.matches("[A-Za-z0-9_]+") && document.matches("[0-9]+"))
      return identity(u.getPath() + "?" + (q.containsKey("bo_table") ? "bo_table=" + board + "&wr_id=" + document : "mid=" + board + "&document_srl=" + document), board + ":" + document);
    var m = Pattern.compile("^/(?:[A-Za-z0-9_/-]+/)?([0-9]+)$").matcher(u.getPath());
    if (!m.matches()) throw invalid();
    return identity(u.getPath(), m.group(1));
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
