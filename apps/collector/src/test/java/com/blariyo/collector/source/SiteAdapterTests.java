package com.blariyo.collector.source;

import com.blariyo.collector.source.common.OrderedContentParser;
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
import tools.jackson.databind.JsonNode;

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
    body.html("<img src='https://cdn.fixture.invalid/one.png'>".repeat(201));
    assertThrows(CollectorFailure.class, () -> parser.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8),url,policy(site,url)));
    body.empty();
    assertThrows(CollectorFailure.class, () -> parser.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8),url,policy(site,url)));
    String separator = url.getQuery()==null ? "?" : "&";
    assertEquals(parser.identify(url), parser.identify(URI.create(url + separator + "utm_source=test#comment")));
    assertThrows(CollectorFailure.class, () -> parser.identify(URI.create(url.toString().replace(url.getHost(),"localhost"))));
  }
  @Test void orderedParserKeepsLazySrcsetAndBackgroundImagesButDoesNotDownloadVideoAttachments() {
    URI uri = URI.create("https://fixture.invalid/post/123");
    SourcePolicy policy = new SourcePolicy("fixture.invalid", List.of("/"), "meta[property=og:title],title", "img",
        "fixture contact-fixture.invalid", "ARCALIVE", Map.of("cdn.fixture.invalid", List.of("/")));
    String html = "<html><head><meta property='og:title' content='lazy fixture'></head><body>"
        + "<article><p>before</p>"
        + "<img data-original-src='https://cdn.fixture.invalid/original.jpg' alt='original'>"
        + "<img srcset='https://cdn.fixture.invalid/small.jpg 320w, https://cdn.fixture.invalid/large.jpg 1280w' alt='large'>"
        + "<div style=\"background-image:url('https://cdn.fixture.invalid/bg.webp')\" aria-label='background'></div>"
        + "<a href='https://cdn.fixture.invalid/movie.mp4'>video file</a>"
        + "<a href='https://cdn.fixture.invalid/file.pdf'>document</a>"
        + "</article></body></html>";

    JsonNode result = new OrderedContentParser(policy, 20, 20).extract(
        html.getBytes(StandardCharsets.UTF_8), uri, "article", "meta[property=og:title],title", "fixture-v1");

    assertEquals(3, result.path("imageCandidates").size());
    assertEquals("https://cdn.fixture.invalid/original.jpg", result.path("imageCandidates").get(0).path("remoteUrl").asText());
    assertEquals("https://cdn.fixture.invalid/large.jpg", result.path("imageCandidates").get(1).path("remoteUrl").asText());
    assertEquals("https://cdn.fixture.invalid/bg.webp", result.path("imageCandidates").get(2).path("remoteUrl").asText());
    assertEquals(1, result.path("attachmentCandidates").size());
    assertEquals("https://cdn.fixture.invalid/file.pdf", result.path("attachmentCandidates").get(0).path("remoteUrl").asText());
    assertTrue(result.path("contentBlocks").toString().contains("movie.mp4"));
  }

  @Test void listAdaptersSkipNoticeRowsAndKeepRegularPosts() {
    var adapter = SiteAdapters.require("ARCALIVE");
    URI listUrl = URI.create("https://arca.live/b/live");
    String html = "<div class='article-list'>"
        + "<div class='vrow notice'><a class='title' href='/b/live/111'>공지: 운영 안내</a></div>"
        + "<div class='vrow'><span class='badge'>공지</span><a class='title' href='/b/live/222'>필독 안내</a></div>"
        + "<div class='vrow'><a class='title' href='/b/live/333'>일반 게시글</a></div>"
        + "</div>";

    var page = adapter.list(html.getBytes(StandardCharsets.UTF_8), listUrl);

    assertEquals(1, page.entries().size());
    assertEquals("333", page.entries().getFirst().identity().postKey());
  }

  @Test void registryNeverConfusesCoreIdWithSlugAndRejectsAmbiguity() {
    var source = Map.of("host","arca.live","approved",true,"parser","ARCALIVE","pathPrefixes",List.of("/b/"),"userAgent","fixture contact-fixture.invalid");
    var registry = new SourceRegistry(Json.tree(Map.of("arcalive",source)));
    assertEquals("arcalive", registry.host("arca.live","421").key());
    assertEquals("https://arca.live/b/live/123",registry.host("arca.live",null).canonical("https://arca.live/b/live/123?p=2"));
    assertThrows(CollectorFailure.class, () -> new SourceRegistry(Json.tree(Map.of("a",source,"b",source))).host("arca.live",null));
    assertThrows(CollectorFailure.class, () -> SiteAdapters.require("METADATA"));
    assertThrows(CollectorFailure.class, () -> SiteAdapters.require("UNKNOWN_SITE"));
  }
  @Test void observedDcconOriginUsesOnlyConfiguredImagePathAndNeverDetailPermission() throws Exception {
    var policy = SourceRegistry.read("ops/reference-sites.sources.example.json").key("dcinside").policy();
    var uri = URI.create("https://gall.dcinside.com/board/view/?id=hit&no=17805");
    var parsed = policy.extract(Files.readAllBytes(Path.of("src/test/resources/sites/dcinside.dccon.observed.html")), uri);
    assertEquals(1,parsed.path("imageCandidates").size());
    assertEquals("https://dcimg5.dcinside.com/dccon.php?no=fixture",parsed.path("imageCandidates").get(0).path("remoteUrl").asText());
    assertThrows(CollectorFailure.class,()->policy.imagePolicy("https://dcimg5.dcinside.com/unobserved/path"));
    assertThrows(CollectorFailure.class,()->policy.imagePolicy("https://dcimg6.dcinside.com/dccon.php?no=fixture"));
    assertThrows(CollectorFailure.class,()->policy.allow("https://dcimg5.dcinside.com/dccon.php?no=fixture"));
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
