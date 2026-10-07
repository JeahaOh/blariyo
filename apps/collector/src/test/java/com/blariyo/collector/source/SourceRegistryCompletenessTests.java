package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.Json;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class SourceRegistryCompletenessTests {
  @org.junit.jupiter.params.ParameterizedTest
  @org.junit.jupiter.params.provider.ValueSource(strings={"dcinside","arcalive","bobaedream"})
  void disabledLiveSourcesKeepOfflineParsersWithoutChangingApproval(String key) {
    var source=SourceRegistry.read("ops/reference-sites.sources.example.json").key(key);
    var before=Json.canonical(source.config());
    assertFalse(source.config().path("approved").asBoolean());
    assertEquals("SOURCE_DISABLED",source.config().path("blockedReason").asText());
    assertEquals("SOURCE_NOT_ALLOWED",assertThrows(com.blariyo.collector.shared.CollectorFailure.class,source::policy).getMessage());
    var offline=ObservedFixtureMain.offlinePolicy(source);
    assertEquals(source.config().path("host").asText(),offline.host());
    assertEquals(source.config().path("parser").asText(),offline.parser());
    assertThrows(com.blariyo.collector.shared.CollectorFailure.class,()->offline.allow("https://foreign.invalid/"));
    assertArrayEquals(before,Json.canonical(source.config()));
    assertEquals("SOURCE_NOT_ALLOWED",assertThrows(com.blariyo.collector.shared.CollectorFailure.class,source::policy).getMessage());
  }

  @Test
  void allTwentyOneSourcesHaveDetailParserAndHotListSourcesHaveListAdapters() throws Exception {
    var root = Path.of("ops/reference-sites.sources.example.json");
    var sources = Json.parse(Files.readAllBytes(root));
    assertEquals(21, sources.size());
    for (var entry : sources.properties()) {
      String sourceKey = entry.getKey();
      String parser = entry.getValue().path("parser").asText();
      assertNotEquals("BLOCKED", parser, sourceKey + " must keep a real detail parser even when live verification is disabled");
      assertTrue("THEQOO".equals(parser) || SiteAdapters.supported(parser), sourceKey + " parser must be registered");
      if (!entry.getValue().path("charts").isEmpty()) {
        assertTrue(SiteAdapters.supported(parser), sourceKey + " hot-list source must have a SiteAdapter list/detail pair");
        assertTrue(entry.getValue().path("verification").path("listFixture").asBoolean(false), sourceKey + " hot-list source needs list fixture evidence");
        assertTrue(entry.getValue().path("verification").path("detailFixture").asBoolean(false), sourceKey + " hot-list source needs detail fixture evidence");
      }
    }
  }
}
