package com.blariyo.collector.source.sites.dmitory;

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
public final class DmitoryAdapter extends AbstractSiteAdapter {
  private final DmitoryListParser listParser = new DmitoryListParser(this);
  private final DmitoryDetailParser detailParser = new DmitoryDetailParser(this);

  protected String host() { return "www.dmitory.com"; }

  public Identity identify(URI u) {
    check(u);
    var direct = Pattern.compile("^/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
    if (direct.matches()) return identity(u.getPath(), direct.group(1) + ":" + direct.group(2));
    var root = Pattern.compile("^/([0-9]+)$").matcher(u.getPath());
    if (root.matches()) return identity("/issue/" + root.group(1), "issue:" + root.group(1));
    var q = query(u); String mid = q.getOrDefault("mid", ""), id = q.getOrDefault("document_srl", "");
    if (!"/index.php".equals(u.getPath()) || !mid.matches("[A-Za-z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
    return identity("/" + mid + "/" + id, mid + ":" + id);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
