package com.blariyo.collector.source;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import tools.jackson.databind.JsonNode;

/** List discovery and detail extraction are different contracts, sharing URL identity only. */
public interface SiteAdapter {
  record Identity(URI canonical, String postKey) {}
  record Entry(Identity identity, Instant publishedAt) {}
  record Page(List<Entry> entries, URI next) {}
  Identity identify(URI url);
  Page list(byte[] html, URI url);
  JsonNode detail(byte[] html, URI url, SourcePolicy policy);
}
