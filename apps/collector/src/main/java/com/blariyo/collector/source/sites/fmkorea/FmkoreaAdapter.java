package com.blariyo.collector.source.sites.fmkorea;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.regex.Pattern;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class FmkoreaAdapter extends AbstractSiteAdapter {
  private final FmkoreaListParser listParser = new FmkoreaListParser(this);
  private final FmkoreaDetailParser detailParser = new FmkoreaDetailParser(this);

  protected String host() { return "www.fmkorea.com"; }

  public Identity identify(URI u) {
    check(u); var m = Pattern.compile("^/(?:best/)?([0-9]+)$").matcher(u.getPath());
    if (!m.matches()) throw invalid();
    return identity("/" + m.group(1), m.group(1));
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
