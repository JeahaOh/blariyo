package com.blariyo.collector.source.common;

import com.blariyo.collector.source.SiteAdapter.Identity;
import java.net.URI;

/** Pure parsing context; delegates URL identity and validation to its owning adapter. */
public abstract class SiteParsingContext {
  private final AbstractSiteAdapter adapter;

  protected SiteParsingContext(AbstractSiteAdapter adapter) { this.adapter = adapter; }
  protected final Identity identify(URI url) { return adapter.identify(url); }
  protected final void check(URI url) { adapter.check(url); }
}
