package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.PinnedHttp;
import com.blariyo.collector.source.SourceRegistry;
import com.blariyo.collector.source.SourceTransport;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class DirectUrlRunnerAllSiteParserTests {
  @ParameterizedTest
  @MethodSource("manualSites")
  void directUrlWriteDbUsesSiteDetailParserAndStoresRawMediaReport(String sourceKey, String parser, String url, String bodySelector) {
    var store = mock(BatchStore.class);
    var objects = mock(BatchObjectStore.class);
    UUID run = UUID.randomUUID(), item = UUID.randomUUID();
    when(store.begin(eq(sourceKey), eq("manual"), eq("WRITE_DB"), eq(1), eq(1), eq(0L), isNull())).thenReturn(run);
    when(store.item(eq(run), eq(sourceKey), anyString(), eq(url), eq("FETCHING"), contains("fixture title"), contains("fixture body"), contains("file.pdf"), contains("x.com/fixture/status/123"), isNull())).thenReturn(item);
    when(objects.put(anyString(), any(), anyString())).thenAnswer(invocation ->
        new BatchObjectStore.Record(invocation.getArgument(0), new byte[32], ((byte[]) invocation.getArgument(1)).length, invocation.getArgument(2)));

    var report = new DirectUrlRunner(transport(url, bodySelector), store, objects, ignored -> {})
        .run(source(sourceKey, parser), new DirectUrlRunner.Options(sourceKey, url, 0, true));

    assertEquals("COMPLETED", report.state(), report.toString());
    assertEquals(1, report.fetched());
    verify(objects).put(contains("collect/raw/"), any(), eq("text/html"));
    verify(store).raw(eq(item), contains("collect/raw/"));
    verify(store).media(eq(item), eq(1), eq("IMAGE"), eq("https://cdn.fixture.invalid/one.png"), contains("collect/media/"), any(), eq("image/png"), eq(4L));
    verify(store).media(eq(item), eq(2), eq("FILE"), eq("https://cdn.fixture.invalid/file.pdf"), contains("collect/media/"), any(), eq("application/pdf"), eq(4L));
    verify(store).completeItem(eq(item));
    verify(objects).put(contains("collect/report/"), any(), eq("application/jsonl"));
    verify(store).finish(eq(run), eq("COMPLETED"), anyMap(), contains("collect/report/"));
  }

  static Stream<Arguments> manualSites() {
    return Stream.of(
        Arguments.of("arcalive", "ARCALIVE", "https://arca.live/b/live/123456", ".article-view .article-content"),
        Arguments.of("bobaedream", "BOBAEDREAM", "https://www.bobaedream.co.kr/view?code=strange&No=123456", ".bodyCont[itemprop=articleBody]"),
        Arguments.of("clien", "CLIEN", "https://www.clien.net/service/board/park/12345678", ".post_article"),
        Arguments.of("dcinside", "DCINSIDE", "https://gall.dcinside.com/board/view/?id=hit&no=123456", ".write_div"),
        Arguments.of("dmitory", "DMITORY", "https://www.dmitory.com/issue/345678", ".read_body .xe_content"),
        Arguments.of("dogdrip", "DOGDRIP", "https://www.dogdrip.net/123456", "div[class~=document_[0-9]+_0].xe_content"),
        Arguments.of("etoland", "ETOLAND", "https://etoland.co.kr/bbs/board.php?bo_table=etohumor06&wr_id=123456", "#bo_v_con"),
        Arguments.of("fmkorea", "FMKOREA", "https://www.fmkorea.com/1234567890", ".xe_content"),
        Arguments.of("goodgag", "GOODGAG", "https://www.goodgag.net/?mid=humor&document_srl=123456", ".xe_content"),
        Arguments.of("humoruniv", "HUMORUNIV", "https://web.humoruniv.com/board/humor/read.html?table=pds&number=123456", "#cnts"),
        Arguments.of("instiz", "INSTIZ", "https://www.instiz.net/pt/1234567", "#memo_content_1"),
        Arguments.of("inven", "INVEN", "https://www.inven.co.kr/board/webzine/2097/123456", "#powerbbsContent"),
        Arguments.of("mlbpark", "MLBPARK", "https://mlbpark.donga.com/mp/b.php?m=view&b=bullpen&id=202609230123456789", "#contentDetail"),
        Arguments.of("natepann", "NATEPANN", "https://pann.nate.com/talk/123456789", "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea"),
        Arguments.of("pgr21", "PGR21", "https://pgr21.com/humor/123456", ".viewContent"),
        Arguments.of("ppomppu", "PPOMPPU", "https://www.ppomppu.co.kr/zboard/view.php?id=freeboard&no=123456", ".board-contents"),
        Arguments.of("ruliweb", "RULIWEB", "https://bbs.ruliweb.com/community/board/300143/read/123456", ".view_content"),
        Arguments.of("theqoo", "THEQOO", "https://theqoo.net/hot/1234567890", "article[itemprop=articleBody]"),
        Arguments.of("todayhumor", "TODAYHUMOR", "https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=123456", "#viewContent"),
        Arguments.of("yuldo", "YULDO", "https://yul-do.com/hot/234567", ".xe_content"),
        Arguments.of("youtube-community", "YOUTUBE_COMMUNITY", "https://www.youtube.com/post/UgkxFixture123", "ytd-backstage-post-renderer #content-text")
    );
  }

  private static SourceRegistry.Source source(String sourceKey, String parser) {
    URI base = URI.create(switch (sourceKey) {
      case "arcalive" -> "https://arca.live/";
      case "bobaedream" -> "https://www.bobaedream.co.kr/";
      case "clien" -> "https://www.clien.net/";
      case "dcinside" -> "https://gall.dcinside.com/";
      case "dmitory" -> "https://www.dmitory.com/";
      case "dogdrip" -> "https://www.dogdrip.net/";
      case "etoland" -> "https://etoland.co.kr/";
      case "fmkorea" -> "https://www.fmkorea.com/";
      case "goodgag" -> "https://www.goodgag.net/";
      case "humoruniv" -> "https://web.humoruniv.com/";
      case "instiz" -> "https://www.instiz.net/";
      case "inven" -> "https://www.inven.co.kr/";
      case "mlbpark" -> "https://mlbpark.donga.com/";
      case "natepann" -> "https://pann.nate.com/";
      case "pgr21" -> "https://pgr21.com/";
      case "ppomppu" -> "https://www.ppomppu.co.kr/";
      case "ruliweb" -> "https://bbs.ruliweb.com/";
      case "theqoo" -> "https://theqoo.net/";
      case "todayhumor" -> "https://www.todayhumor.co.kr/";
      case "yuldo" -> "https://yul-do.com/";
      case "youtube-community" -> "https://www.youtube.com/";
      default -> throw new IllegalArgumentException(sourceKey);
    });
    return new SourceRegistry(Json.tree(Map.of(sourceKey, Map.ofEntries(
        Map.entry("host", base.getHost()),
        Map.entry("approved", true),
        Map.entry("blockedReason", ""),
        Map.entry("parser", parser),
        Map.entry("pathPrefixes", List.of("/")),
        Map.entry("userAgent", "fixture contact-test"),
        Map.entry("imageOrigins", Map.of("https://cdn.fixture.invalid", List.of("/"))),
        Map.entry("charts", Map.of()),
        Map.entry("chartVerified", false),
        Map.entry("batchApproved", false))))).key(sourceKey);
  }

  private static SourceTransport transport(String url, String bodySelector) {
    return new SourceTransport() {
      public void validate(URI uri) {}
      public PinnedHttp.Response get(URI uri, int maximum, String userAgent) {
        if (uri.getHost().equals("cdn.fixture.invalid"))
          return new PinnedHttp.Response(200, uri.getPath().endsWith(".pdf") ? "application/pdf" : "image/png", Map.of(), new byte[] {1, 2, 3, 4});
        String html = "<html><head><meta property='og:title' content='fixture title'>"
            + "<link rel='canonical' href='" + url + "'></head><body>"
            + element(bodySelector, "<p>fixture body https://x.com/fixture/status/123</p><img src='https://cdn.fixture.invalid/one.png'><a href='https://cdn.fixture.invalid/file.pdf'>attachment</a>")
            + "</body></html>";
        return new PinnedHttp.Response(200, "text/html", Map.of(), html.getBytes(StandardCharsets.UTF_8));
      }
    };
  }

  private static String element(String selector, String content) {
    return switch (selector) {
      case "#viewContent" -> "<div id='viewContent'>" + content + "</div>";
      case "#bo_v_con" -> "<div id='bo_v_con'>" + content + "</div>";
      case "#cnts" -> "<div id='cnts'>" + content + "</div>";
      case "#memo_content_1" -> "<div id='memo_content_1'>" + content + "</div>";
      case "#contentDetail" -> "<div id='contentDetail'>" + content + "</div>";
      case "#contentArea" -> "<div id='contentArea'>" + content + "</div>";
      case "#powerbbsContent" -> "<div id='powerbbsContent'>" + content + "</div>";
      case "article[itemprop=articleBody]" -> "<article itemprop='articleBody'>" + content + "</article>";
      case ".article-view .article-content" -> "<div class='article-view'><div class='article-content'>" + content + "</div></div>";
      case ".bodyCont[itemprop=articleBody]" -> "<div class='bodyCont' itemprop='articleBody'>" + content + "</div>";
      case "div[class~=document_[0-9]+_0].xe_content" -> "<div class='document_123456_0 xe_content'>" + content + "</div>";
      case "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea" -> "<div class='viewarea'><div class='view-wrap'><div class='posting'><table><tbody><tr><td><div id='contentArea'>" + content + "</div></td></tr></tbody></table></div></div></div>";
      case ".read_body .xe_content" -> "<article class='read_body'><div class='xe_content'>" + content + "</div></article>";
      case "ytd-backstage-post-renderer #content-text" -> "<ytd-backstage-post-renderer><yt-formatted-string id='content-text'>" + content + "</yt-formatted-string></ytd-backstage-post-renderer>";
      default -> "<div class='" + selector.substring(1) + "'>" + content + "</div>";
    };
  }
}
