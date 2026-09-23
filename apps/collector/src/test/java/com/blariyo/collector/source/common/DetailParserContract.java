package com.blariyo.collector.source.common;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.SourcePolicy;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Runs the same preservation requirements independently in each site's test package. */
public abstract class DetailParserContract {
  private final String site;
  private final String bodySelector;

  protected DetailParserContract(String site, String bodySelector) {
    this.site = site;
    this.bodySelector = bodySelector;
  }
  protected abstract JsonNode parse(byte[] html, URI url, SourcePolicy policy);
  protected String body(String html) { return html; }
  protected void prepare(Document doc) {}

  @Test protected void fullOutputMatchesPreSplitFingerprint() throws Exception {
    var f = SiteFixtureSupport.fixture(site, "detail");
    var parsed = parse(f.html(), f.url(), f.policy());
    assertEquals(f.adapter().detail(f.html(), f.url(), f.policy()), parsed);
    assertEquals(SiteFixtureSupport.expected(site, "detail"), Json.sha(Json.canonical(
        Json.tree(Map.of("identity", f.adapter().identify(f.url()), "detail", parsed)))));
  }

  @Test protected void canonicalIdentitySurvivesTrackingButRejectsForeignHost() throws Exception {
    var f = SiteFixtureSupport.fixture(site, "detail");
    var id = f.adapter().identify(f.url());
    assertEquals(id, f.adapter().identify(URI.create(f.url() + (f.url().getRawQuery() == null ? "?" : "&") + "utm_source=fixture#comment")));
    assertEquals(id, f.adapter().identify(id.canonical()));
    var failure = assertThrows(CollectorFailure.class, () -> f.adapter().identify(
        URI.create(f.url().toString().replace(f.url().getHost(), "foreign.fixture.invalid"))));
    assertEquals("SOURCE_URL_INVALID", failure.getMessage());
  }

  @Test protected void mixedMediaTextOnlyLinkOnlyAndEmptyBodyRemainDistinct() throws Exception {
    var f = SiteFixtureSupport.fixture(site, "detail");
    var doc = Jsoup.parse(new String(f.html(), StandardCharsets.UTF_8));
    prepare(doc);
    var article = doc.selectFirst(bodySelector);
    assertNotNull(article, site + " fixture body selector");
    article.html(body("<p>before</p><img data-src='https://cdn.fixture.invalid/one.png'><p>between</p>"
        + "<img src='https://cdn.fixture.invalid/two.png'><p>after</p>"
        + "<blockquote class='twitter-tweet'><a href='https://x.com/fixture/status/123'>tweet</a></blockquote>"
        + "<iframe src='https://www.youtube.com/embed/Abcdefghijk'></iframe>"
        + "<blockquote data-instgrm-permalink='https://www.instagram.com/p/Abcd/'></blockquote>"
        + "<a href='https://www.tiktok.com/@fixture/video/123'>video</a>"
        + "<a href='https://cdn.fixture.invalid/file.pdf'>document</a>"));
    var result = parse(bytes(doc), f.url(), f.policy());
    var types = new ArrayList<String>();
    result.path("contentBlocks").forEach(b -> types.add(b.path("type").asText()));
    assertEquals(List.of("TEXT", "IMAGE", "TEXT", "IMAGE", "TEXT", "LINK", "LINK", "LINK", "LINK", "LINK"), types);
    assertEquals("before", result.path("contentBlocks").get(0).path("text").asText());
    assertEquals("between", result.path("contentBlocks").get(2).path("text").asText());
    assertEquals("after", result.path("contentBlocks").get(4).path("text").asText());
    assertEquals(2, result.path("imageCandidates").size());
    assertEquals(1, result.path("attachmentCandidates").size());
    for (String link : List.of("x.com/fixture/status/123", "youtube.com", "instagram.com/p/Abcd/", "tiktok.com/@fixture/video/123"))
      assertTrue(result.path("contentBlocks").toString().contains(link), link);

    article.html(body("<p>text only</p>"));
    var text = parse(bytes(doc), f.url(), f.policy());
    assertEquals(1, text.path("contentBlocks").size());
    assertEquals("TEXT", text.path("contentBlocks").get(0).path("type").asText());
    assertEquals(0, text.path("imageCandidates").size());

    article.html(body("<a href='https://x.com/fixture/status/123'>link only</a>"));
    var link = parse(bytes(doc), f.url(), f.policy());
    assertEquals(1, link.path("contentBlocks").size());
    assertEquals("LINK", link.path("contentBlocks").get(0).path("type").asText());
    assertEquals(0, link.path("imageCandidates").size());

    article.html(body(""));
    assertEquals("PARSE_FAILED", assertThrows(CollectorFailure.class,
        () -> parse(bytes(doc), f.url(), f.policy())).getMessage());
    article.remove();
    assertEquals("PARSE_FAILED", assertThrows(CollectorFailure.class,
        () -> parse(bytes(doc), f.url(), f.policy())).getMessage());
  }

  private static byte[] bytes(Document doc) { return doc.outerHtml().getBytes(StandardCharsets.UTF_8); }
}
