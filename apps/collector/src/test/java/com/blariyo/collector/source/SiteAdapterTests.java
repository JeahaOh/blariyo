package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SiteAdapterTests {
  private static byte[] fixture(String site, String kind) throws Exception {
    return Files.readAllBytes(Path.of("src/test/resources/sites/" + site + "." + kind + ".html"));
  }
  private static URI url(String site, String kind) throws Exception {
    for (var row : Json.parse(Files.readAllBytes(Path.of("src/test/resources/sites/fixture-provenance.json"))))
      if (row.path("source").asText().equals(site) && row.path("kind").asText().equals(kind)) return URI.create(row.path("url").asText());
    throw new AssertionError();
  }
  private static SourcePolicy policy(String site, URI url) {
    return new SourcePolicy(url.getHost(), List.of("/"), "meta[property=og:title],title", "img", "fixture contact-fixture.invalid",
        site.toUpperCase(), Map.of("cdn.fixture.invalid", List.of("/")));
  }
  @ParameterizedTest @ValueSource(strings={"arcalive", "bobaedream", "dogdrip", "inven"})
  void sanitizedObservedListAndDetail(String site) throws Exception {
    var adapter = SiteAdapters.require(site);
    var list = adapter.list(fixture(site, "list"), url(site, "list"));
    assertTrue(list.entries().size() >= 10);
    assertEquals(list.entries().size(), list.entries().stream().map(e -> e.identity().postKey()).distinct().count());
    var detail = adapter.detail(fixture(site, "detail"), url(site, "detail"), policy(site, url(site, "detail")));
    assertTrue(detail.path("contentBlocks").size() > 0);
    assertNotEquals("jsoup-1.23.2-v1", detail.path("parserVersion").asText());
    assertFalse(detail.toString().contains("<script"));
    assertThrows(CollectorFailure.class, () -> adapter.detail("<title>gone</title>".getBytes(), url(site, "detail"), policy(site,url(site,"detail"))));
    assertThrows(CollectorFailure.class, () -> adapter.list("<html>challenge</html>".getBytes(), url(site,"list")));
  }
  @ParameterizedTest @ValueSource(strings={"arcalive", "bobaedream", "dogdrip", "inven"})
  void orderedBodyImagesSnsOnlyEmptyAndDuplicateUrls(String site) throws Exception {
    URI url = url(site,"detail");
    var doc = Jsoup.parse(new String(fixture(site,"detail"), StandardCharsets.UTF_8));
    var body = doc.selectFirst(switch(site) {
      case "arcalive" -> ".article-content";
      case "bobaedream" -> ".bodyCont";
      case "dogdrip" -> ".xe_content";
      default -> "#powerbbsContent";
    });
    assertNotNull(body);
    body.html("<p>before</p><img data-src='https://cdn.fixture.invalid/one.png'><p>after</p>"
        + "<blockquote class='twitter-tweet'><a href='https://x.com/fixture/status/123'>ignored SNS text</a></blockquote>"
        + "<iframe src='https://www.youtube.com/embed/Abcdefghijk'></iframe>"
        + "<blockquote data-instgrm-permalink='https://www.instagram.com/p/Abcd/'></blockquote>"
        + "<a href='https://www.tiktok.com/@fixture/video/123'>TikTok</a>"
        + "<a href='https://reference.fixture.invalid/file.pdf'>file</a>");
    var parser = SiteAdapters.require(site);
    var result = parser.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8), url, policy(site,url));
    var blocks = result.path("contentBlocks");
    assertEquals("before", blocks.get(0).path("text").asText());
    assertEquals("IMAGE", blocks.get(1).path("type").asText());
    assertEquals("after", blocks.get(2).path("text").asText());
    assertEquals(8, blocks.size());
    assertEquals(1, result.path("imageCandidates").size());
    assertFalse(result.toString().contains("ignored SNS text"));
    body.html("<p>text only</p>");
    assertEquals(0, parser.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8),url,policy(site,url)).path("imageCandidates").size());
    body.html("<a href='https://x.com/fixture/status/123'>link only</a>");
    assertEquals("LINK", parser.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8),url,policy(site,url)).path("contentBlocks").get(0).path("type").asText());
    body.empty();
    assertThrows(CollectorFailure.class, () -> parser.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8),url,policy(site,url)));
    String separator = url.getQuery()==null ? "?" : "&";
    assertEquals(parser.identify(url), parser.identify(URI.create(url + separator + "utm_source=test#comment")));
    assertThrows(CollectorFailure.class, () -> parser.identify(URI.create(url.toString().replace(url.getHost(),"localhost"))));
  }
  @Test void registryNeverConfusesCoreIdWithSlugAndRejectsAmbiguity() {
    var source = Map.of("host","arca.live","approved",true,"parser","ARCALIVE","pathPrefixes",List.of("/b/"),"userAgent","fixture contact-fixture.invalid");
    var registry = new SourceRegistry(Json.tree(Map.of("arcalive",source)));
    assertEquals("arcalive", registry.host("arca.live","421").key());
    assertEquals("https://arca.live/b/live/123",registry.host("arca.live",null).canonical("https://arca.live/b/live/123?p=2"));
    assertThrows(CollectorFailure.class, () -> new SourceRegistry(Json.tree(Map.of("a",source,"b",source))).host("arca.live",null));
    assertThrows(CollectorFailure.class, () -> SiteAdapters.require("METADATA"));
    assertThrows(CollectorFailure.class, () -> SiteAdapters.require("youtube-community"));
  }
  @Test void robotsHonorsQueryLongestRulesAndDoesNotAcceptChallenge() {
    var rules = new RobotsRules("User-agent: *\nDisallow: /\nAllow: /best\nDisallow: /*?secret=\nCrawl-delay: 10\n");
    assertTrue(rules.allows("blariyo",URI.create("https://fixture.invalid/best")));
    assertFalse(rules.allows("blariyo",URI.create("https://fixture.invalid/best?secret=x")));
    assertEquals(10000, rules.delayMillis("blariyo"));
    assertFalse(new RobotsRules("<html>captcha</html>").allows("blariyo",URI.create("https://fixture.invalid/")));
    assertFalse(new RobotsRules("").allows("blariyo",URI.create("https://fixture.invalid/")));
    assertTrue(new RobotsRules("User-agent: *\nDisallow: /\nUser-agent: blariyo\nAllow: /\n").allows("blariyo-collector",URI.create("https://fixture.invalid/")));
  }
}
