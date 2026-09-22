package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class AdditionalHotListAdapterTests {
  @ParameterizedTest
  @MethodSource("sites")
  void listAndDetailAreBothImplemented(String parser, String listUrl, String listHtml, String detailUrl,
      String expectedPostKey, String bodySelector, String imageUrl) {
    var adapter = SiteAdapters.require(parser);
    var page = adapter.list(listHtml.getBytes(StandardCharsets.UTF_8), URI.create(listUrl));
    assertEquals(1, page.entries().size());
    assertEquals(expectedPostKey, page.entries().getFirst().identity().postKey());

    URI detail = URI.create(detailUrl);
    String host = detail.getHost();
    SourcePolicy policy = new SourcePolicy(host, List.of("/"), "meta[property=og:title],title", "img",
        "fixture contact-test", parser, Map.of(URI.create(imageUrl).getHost(), List.of("/")));
    String html = "<html><head><meta property='og:title' content='" + parser + " fixture'>"
        + "<link rel='canonical' href='" + detailUrl + "'></head><body>"
        + element(bodySelector, "<p>fixture body</p><img src='" + imageUrl + "'><a href='https://x.com/fixture/status/123'>sns</a>")
        + "</body></html>";
    var result = adapter.detail(html.getBytes(StandardCharsets.UTF_8), detail, policy);
    assertEquals(parser + " fixture", result.path("title").asText());
    assertEquals(1, result.path("imageCandidates").size());
    assertTrue(result.path("contentBlocks").toString().contains("fixture body"));
    assertTrue(result.path("contentBlocks").toString().contains("x.com/fixture/status/123"));
  }

  static Stream<Arguments> sites() {
    return Stream.of(
        Arguments.of("DMITORY", "https://www.dmitory.com/issue",
            "<table><tr><td class='title'><a class='hx' href='https://www.dmitory.com/issue/426328955'>d</a></td></tr></table>",
            "https://www.dmitory.com/issue/426328955", "issue:426328955", ".read_body .xe_content", "https://www.dmitory.com/files/a.jpg"),
        Arguments.of("THEQOO", "https://theqoo.net/hot",
            "<table class='theqoo_board_table'><tbody class='hide_notice'><tr><td class='title'><a href='/hot/4353448483'>t</a></td></tr></tbody></table>",
            "https://theqoo.net/hot/4353448483", "4353448483", "article[itemprop=articleBody]", "https://img.theqoo.net/a.jpg"),
        Arguments.of("RULIWEB", "https://bbs.ruliweb.com/best/humor",
            "<div id='best_body'><table class='board_list_table'><tr><td class='subject'><a class='subject_link' href='/best/board/300143/read/76767435?m=humor'>r</a></td></tr></table></div>",
            "https://bbs.ruliweb.com/best/board/300143/read/76767435", "300143:76767435", ".view_content[itemprop=articleBody], .view_content", "https://i1.ruliweb.com/a.jpg"),
        Arguments.of("CLIEN", "https://www.clien.net/service/board/park",
            "<div class='list_item symph_row' data-role='list-row'><a class='list_subject' href='/service/board/park/19268240?od=T31&po=0'>c</a></div>",
            "https://www.clien.net/service/board/park/19268240", "park:19268240", ".post_article, article .post-content, .board_read .content", "https://www.clien.net/a.jpg"),
        Arguments.of("INSTIZ", "https://www.instiz.net/pt",
            "<table><tr><td><a href='https://www.instiz.net/pt/7905879?green=1'>i</a></td></tr></table>",
            "https://www.instiz.net/pt/7905879", "pt:7905879", "#memo_content_1, .memo_content, .post_content, article .content", "https://cdn.instiz.net/data/a.jpg"),
        Arguments.of("NATEPANN", "https://pann.nate.com/talk/c20002",
            "<table><tr><td><a href='/talk/375634702'>n</a></td></tr></table><div class='paginate'><a class='paging' href='/talk/c20002?page=2'>2</a></div>",
            "https://pann.nate.com/talk/375634702", "375634702", "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea", "https://fimg6.pann.com/new/download.jsp?FileID=a"),
        Arguments.of("FMKOREA", "https://www.fmkorea.com/best",
            "<ul><li><a href='/1234567890'>f</a></li></ul><a href='/best?page=2'>next</a>",
            "https://www.fmkorea.com/1234567890", "1234567890", ".xe_content", "https://www.fmkorea.com/files/a.jpg"),
        Arguments.of("PPOMPPU", "https://www.ppomppu.co.kr/hot.php",
            "<table><tr><td><a href='/zboard/view.php?id=freeboard&no=123456'>p</a></td></tr></table><a href='/hot.php?page=2'>2</a>",
            "https://www.ppomppu.co.kr/zboard/view.php?id=freeboard&no=123456", "freeboard:123456", ".board-contents", "https://www.ppomppu.co.kr/files/a.jpg")
    );
  }

  private static String element(String selector, String content) {
    if (selector.equals("article[itemprop=articleBody]")) return "<article itemprop='articleBody'>" + content + "</article>";
    if (selector.equals(".read_body .xe_content")) return "<article class='read_body'><div class='xe_content'>" + content + "</div></article>";
    if (selector.equals(".view_content[itemprop=articleBody], .view_content")) return "<div class='view_content' itemprop='articleBody'>" + content + "</div>";
    if (selector.equals(".post_article, article .post-content, .board_read .content")) return "<div class='post_article'>" + content + "</div>";
    if (selector.equals("#memo_content_1, .memo_content, .post_content, article .content")) return "<div id='memo_content_1'>" + content + "</div>";
    if (selector.equals("div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea")) return "<div class='viewarea'><div class='view-wrap'><div class='posting'><table><tbody><tr><td><div id='contentArea'>" + content + "</div></td></tr></tbody></table></div></div></div>";
    return selector.startsWith("#") ? "<div id='" + selector.substring(1) + "'>" + content + "</div>"
        : "<div class='" + selector.substring(1) + "'>" + content + "</div>";
  }
}
