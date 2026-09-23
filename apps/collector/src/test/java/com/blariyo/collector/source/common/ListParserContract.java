package com.blariyo.collector.source.common;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.SiteAdapter;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

public abstract class ListParserContract {
  private final String site;
  protected ListParserContract(String site) { this.site = site; }
  protected abstract SiteAdapter.Page parse(byte[] html, URI url);

  @Test protected void fullListOrderDatesIdentitiesAndPaginationMatchPreSplitFingerprint() throws Exception {
    var f = SiteFixtureSupport.fixture(site, "list");
    var page = parse(f.html(), f.url());
    assertEquals(f.adapter().list(f.html(), f.url()), page);
    assertEquals(SiteFixtureSupport.expected(site, "list"), Json.sha(Json.canonical(Json.tree(page))));
    assertFalse(page.entries().isEmpty());
    assertEquals(page.entries().size(), page.entries().stream().map(e -> e.identity().postKey()).distinct().count());
  }

  @Test protected void challengeAndMissingListCannotBecomeSuccessfulEmptyPages() throws Exception {
    var f = SiteFixtureSupport.fixture(site, "list");
    assertEquals("LIST_STRUCTURE_CHANGED", assertThrows(CollectorFailure.class,
        () -> parse("<title>gone</title>".getBytes(StandardCharsets.UTF_8), f.url())).getMessage());
    assertEquals("SOURCE_ACCESS_BLOCKED", assertThrows(CollectorFailure.class,
        () -> parse("<title>Just a moment</title>".getBytes(StandardCharsets.UTF_8), f.url())).getMessage());
  }
}
