package com.blariyo.collector.source.common;

import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter;
import java.net.URI;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;

/** URL validation shared by adapters. Site rules stay in the concrete adapter. */
public abstract class AbstractSiteAdapter implements SiteAdapter {
  protected abstract String host();

  public void check(URI u) {
    if (!"https".equals(u.getScheme()) || !host().equalsIgnoreCase(u.getHost())
        || u.getUserInfo() != null || u.getPort() != -1 || u.getPath().contains("..")) throw invalid();
  }

  protected Identity identity(String path, String key) { return new Identity(URI.create("https://" + host() + path), key); }
}
