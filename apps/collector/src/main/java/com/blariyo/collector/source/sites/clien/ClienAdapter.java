package com.blariyo.collector.source.sites.clien;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.regex.Pattern;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class ClienAdapter extends AbstractSiteAdapter {
  private final ClienListParser listParser = new ClienListParser(this);
  private final ClienDetailParser detailParser = new ClienDetailParser(this);

  protected String host() { return "www.clien.net"; }

  public Identity identify(URI u) {
    check(u); var m = Pattern.compile("^/service/board/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
    if (!m.matches()) throw invalid();
    return identity(u.getPath(), m.group(1) + ":" + m.group(2));
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
