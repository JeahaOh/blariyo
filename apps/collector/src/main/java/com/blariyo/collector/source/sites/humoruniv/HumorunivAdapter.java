package com.blariyo.collector.source.sites.humoruniv;

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
public final class HumorunivAdapter extends AbstractSiteAdapter {
  private final HumorunivListParser listParser = new HumorunivListParser(this);
  private final HumorunivDetailParser detailParser = new HumorunivDetailParser(this);

  protected String host() { return "web.humoruniv.com"; }

  public void check(URI u) {
    if (!"https".equals(u.getScheme()) || !("web.humoruniv.com".equalsIgnoreCase(u.getHost()) || "m.humoruniv.com".equalsIgnoreCase(u.getHost()) || "humoruniv.com".equalsIgnoreCase(u.getHost()))
        || u.getUserInfo() != null || u.getPort() != -1 || u.getPath().contains("..")) throw invalid();
  }

  private URI mobileUrl(String key) {
    String[] parts = key.split(":", 2);
    return URI.create("https://m.humoruniv.com/board/read.html?table=" + parts[0] + "&number=" + parts[1]);
  }

  public Identity identify(URI u) {
    check(u);
    var shortPath = Pattern.compile("^/([A-Za-z0-9_]+)([0-9]+)$").matcher(u.getPath());
    if (shortPath.matches()) return new Identity(mobileUrl(shortPath.group(1) + ":" + shortPath.group(2)), shortPath.group(1) + ":" + shortPath.group(2));
    var q = query(u); String table = q.getOrDefault("table", ""), number = q.getOrDefault("number", q.getOrDefault("pg", ""));
    if (!u.getPath().matches("^/board/(?:[A-Za-z0-9_/-]+/)?read\\.html$") || !table.matches("[A-Za-z0-9_]+") || !number.matches("[0-9]+")) throw invalid();
    return new Identity(URI.create("https://" + u.getHost() + u.getPath() + "?table=" + table + "&number=" + number), table + ":" + number);
  }

  @Override public Page list(byte[] html, URI url) {
    return listParser.parse(html, url);
  }

  @Override public JsonNode detail(byte[] html, URI url, SourcePolicy policy) {
    return detailParser.parse(html, url, policy);
  }
}
