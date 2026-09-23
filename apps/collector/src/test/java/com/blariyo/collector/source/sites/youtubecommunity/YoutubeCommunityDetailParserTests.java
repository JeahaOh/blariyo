package com.blariyo.collector.source.sites.youtubecommunity;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import tools.jackson.databind.JsonNode;

class YoutubeCommunityDetailParserTests extends DetailParserContract {
  YoutubeCommunityDetailParserTests() { super("youtube-community", "#content-text"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new YoutubeCommunityDetailParser(new YoutubeCommunityAdapter()).parse(html, url, policy);
  }
  @org.junit.jupiter.api.Test void unsupportedListRemainsExplicitlyRejected() {
    var failure = org.junit.jupiter.api.Assertions.assertThrows(com.blariyo.collector.shared.CollectorFailure.class,
        () -> new YoutubeCommunityAdapter().list(new byte[0], URI.create("https://fixture.invalid/")));
    org.junit.jupiter.api.Assertions.assertEquals("CHART_UNVERIFIED", failure.getMessage());
  }
}
