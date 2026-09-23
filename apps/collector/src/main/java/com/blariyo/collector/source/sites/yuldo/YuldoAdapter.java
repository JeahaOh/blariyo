package com.blariyo.collector.source.sites.yuldo;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.regex.Pattern;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class YuldoAdapter extends AbstractSiteAdapter {
  private final YuldoListParser listParser = new YuldoListParser(this);
  private final YuldoDetailParser detailParser = new YuldoDetailParser(this);

  protected String host() { return "yul-do.com"; }

  public Identity identify(URI u) {
    check(u); var m = Pattern.compile("^/([A-Za-z0-9_/-]+)/([0-9]+)$").matcher(u.getPath());
    if (!m.matches()) throw invalid();
    return identity(u.getPath(), m.group(1).replace('/', ':') + ":" + m.group(2));
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
