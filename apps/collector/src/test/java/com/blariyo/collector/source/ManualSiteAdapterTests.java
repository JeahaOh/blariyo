package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.JsonNode;

class ManualSiteAdapterTests {
  @ParameterizedTest
  @MethodSource("manualSites")
  void detailOnlyManualParsersExtractOrderedBodyImagesAndSns(
      String site, String parser, String url, String postKey, String bodySelector) {
    var adapter = SiteAdapters.require(parser);
    URI uri = URI.create(url);
    SourcePolicy policy = new SourcePolicy(uri.getHost(), List.of("/"), "meta[property=og:title],title", "img",
        "fixture contact-test", parser, Map.of("cdn.fixture.invalid", List.of("/")));
    String html = "<html><head><meta property='og:title' content='" + site + " fixture title'>"
        + "<link rel='canonical' href='" + url + "'></head><body>"
        + element(bodySelector, "<p>fixture body</p><img src='https://cdn.fixture.invalid/one.png'>"
        + "<blockquote class='twitter-tweet'><a href='https://x.com/fixture/status/123'>date</a></blockquote>"
        + "<a href='https://www.youtube.com/watch?v=Abcdefghijk'>video</a>")
        + "</body></html>";

    assertEquals(postKey, adapter.identify(uri).postKey());
    JsonNode result = adapter.detail(html.getBytes(StandardCharsets.UTF_8), uri, policy);

    assertEquals(url, result.path("canonicalUrl").asText());
    assertEquals(site + " fixture title", result.path("title").asText());
    assertTrue(result.path("contentBlocks").toString().contains("fixture body"));
    assertEquals(1, result.path("imageCandidates").size());
    assertTrue(result.path("contentBlocks").toString().contains("x.com/fixture/status/123"));
    assertThrows(CollectorFailure.class, () -> adapter.list("<html></html>".getBytes(StandardCharsets.UTF_8), uri));
    assertThrows(CollectorFailure.class, () -> adapter.detail("<title>gone</title>".getBytes(StandardCharsets.UTF_8), uri, policy));
    assertThrows(CollectorFailure.class, () -> adapter.identify(URI.create(url.replace(uri.getHost(), "localhost"))));
  }

  static Stream<Arguments> manualSites() {
    return Stream.of(
        Arguments.of("clien", "CLIEN", "https://www.clien.net/service/board/park/12345678", "park:12345678", ".post_article"),
        Arguments.of("dcinside", "DCINSIDE", "https://gall.dcinside.com/board/view/?id=hit&no=123456", "hit:123456", ".write_div"),
        Arguments.of("etoland", "ETOLAND", "https://etoland.co.kr/bbs/board.php?bo_table=etohumor06&wr_id=123456", "etohumor06:123456", "#bo_v_con"),
        Arguments.of("fmkorea", "FMKOREA", "https://www.fmkorea.com/1234567890", "1234567890", ".xe_content"),
        Arguments.of("goodgag", "GOODGAG", "https://www.goodgag.net/?mid=humor&document_srl=123456", "humor:123456", ".xe_content"),
        Arguments.of("humoruniv", "HUMORUNIV", "https://web.humoruniv.com/board/humor/read.html?table=pds&number=123456", "pds:123456", "#cnts"),
        Arguments.of("instiz", "INSTIZ", "https://www.instiz.net/pt/1234567", "pt:1234567", "#memo_content_1"),
        Arguments.of("mlbpark", "MLBPARK", "https://mlbpark.donga.com/mp/b.php?m=view&b=bullpen&id=202609230123456789", "bullpen:202609230123456789", "#contentDetail"),
        Arguments.of("natepann", "NATEPANN", "https://pann.nate.com/talk/123456789", "123456789", "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea"),
        Arguments.of("pgr21", "PGR21", "https://pgr21.com/humor/123456", "humor:123456", ".viewContent"),
        Arguments.of("ppomppu", "PPOMPPU", "https://www.ppomppu.co.kr/zboard/view.php?id=freeboard&no=123456", "freeboard:123456", ".board-contents"),
        Arguments.of("ruliweb", "RULIWEB", "https://bbs.ruliweb.com/community/board/300143/read/123456", "300143:123456", ".view_content"),
        Arguments.of("yuldo", "YULDO", "https://yul-do.com/hot/234567", "hot:234567", ".xe_content"),
        Arguments.of("youtube-community", "YOUTUBE_COMMUNITY", "https://www.youtube.com/post/UgkxFixture123", "UgkxFixture123", "ytd-backstage-post-renderer #content-text")
    );
  }

  private static String element(String selector, String content) {
    return switch (selector) {
      case "#viewContent" -> "<div id='viewContent'>" + content + "</div>";
      case "#bo_v_con" -> "<div id='bo_v_con'>" + content + "</div>";
      case "#cnts" -> "<div id='cnts'>" + content + "</div>";
      case "#memo_content_1" -> "<div id='memo_content_1'>" + content + "</div>";
      case "#contentDetail" -> "<div id='contentDetail'>" + content + "</div>";
      case "#contentArea" -> "<div id='contentArea'>" + content + "</div>";
      case "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea" -> "<div class='viewarea'><div class='view-wrap'><div class='posting'><table><tbody><tr><td><div id='contentArea'>" + content + "</div></td></tr></tbody></table></div></div></div>";
      case "ytd-backstage-post-renderer #content-text" -> "<ytd-backstage-post-renderer><yt-formatted-string id='content-text'>" + content + "</yt-formatted-string></ytd-backstage-post-renderer>";
      default -> "<div class='" + selector.substring(1) + "'>" + content + "</div>";
    };
  }

  @org.junit.jupiter.api.Test
  void youtubeCommunityExtractsBackstagePostRendererFromInitialData() {
    var adapter = SiteAdapters.require("YOUTUBE_COMMUNITY");
    URI uri = URI.create("https://www.youtube.com/post/UgkxFixture123");
    SourcePolicy policy = new SourcePolicy(uri.getHost(), List.of("/"), "meta[property=og:title],title", "img",
        "fixture contact-test", "YOUTUBE_COMMUNITY", Map.of("i.ytimg.com", List.of("/"), "yt3.ggpht.com", List.of("/")));
    String json = """
        {"contents":{"backstagePostRenderer":{"contentText":{"runs":[{"text":"커뮤니티 본문"}]},"backstageAttachment":{"postMultiImageRenderer":{"images":[{"backstageImageRenderer":{"image":{"thumbnails":[{"url":"https://i.ytimg.com/vi/fixture/hqdefault.jpg"}]}}}]}}}}}
        """;
    String html = "<html><head><meta property='og:title' content='youtube fixture'></head><body><script>var ytInitialData = " + json + ";</script></body></html>";
    JsonNode result = adapter.detail(html.getBytes(StandardCharsets.UTF_8), uri, policy);
    assertEquals("youtube fixture", result.path("title").asText());
    assertEquals("youtube-community-ytinitialdata-v1", result.path("parserVersion").asText());
    assertTrue(result.path("contentBlocks").toString().contains("커뮤니티 본문"));
    assertEquals(1, result.path("imageCandidates").size());
  }

}
