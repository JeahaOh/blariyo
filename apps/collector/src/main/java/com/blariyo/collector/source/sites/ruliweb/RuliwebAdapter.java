package com.blariyo.collector.source.sites.ruliweb;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.regex.Pattern;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class RuliwebAdapter extends AbstractSiteAdapter {
  private final RuliwebListParser listParser = new RuliwebListParser(this);
  private final RuliwebDetailParser detailParser = new RuliwebDetailParser(this);

  protected String host() { return "bbs.ruliweb.com"; }

  public Identity identify(URI u) {
    check(u); var m = Pattern.compile("^/(?:best/board|community/board|family/board|news/board|hobby/board)/([A-Za-z0-9_]+)/read/([0-9]+)$").matcher(u.getPath());
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
