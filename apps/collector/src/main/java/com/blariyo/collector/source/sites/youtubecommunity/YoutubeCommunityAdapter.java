package com.blariyo.collector.source.sites.youtubecommunity;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.AbstractSiteAdapter;
import java.net.URI;
import java.util.regex.Pattern;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import tools.jackson.databind.JsonNode;

/** Site URL identity and parser composition. Live access remains a separate gate. */
public final class YoutubeCommunityAdapter extends AbstractSiteAdapter {
  private final YoutubeCommunityDetailParser detailParser = new YoutubeCommunityDetailParser(this);

  protected String host() { return "www.youtube.com"; }

  public Identity identify(URI u) {
    check(u); var m = Pattern.compile("^/post/([A-Za-z0-9_-]+)$").matcher(u.getPath());
    if (!m.matches()) throw invalid();
    return identity(u.getPath(), m.group(1));
  }

  @Override public Page list(byte[] html, URI url) {
    throw new CollectorFailure(403, "CHART_UNVERIFIED");
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
