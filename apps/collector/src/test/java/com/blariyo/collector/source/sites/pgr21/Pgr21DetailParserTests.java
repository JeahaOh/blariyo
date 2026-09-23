package com.blariyo.collector.source.sites.pgr21;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class Pgr21DetailParserTests extends DetailParserContract {
  Pgr21DetailParserTests() { super("pgr21", ".viewContent"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new Pgr21DetailParser(new Pgr21Adapter()).parse(html, url, policy);
  }
  @org.junit.jupiter.api.Test void unsupportedListRemainsExplicitlyRejected() {
    var failure = org.junit.jupiter.api.Assertions.assertThrows(com.blariyo.collector.shared.CollectorFailure.class,
        () -> new Pgr21Adapter().list(new byte[0], URI.create("https://fixture.invalid/")));
    org.junit.jupiter.api.Assertions.assertEquals("CHART_UNVERIFIED", failure.getMessage());
  }
}
