package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TodayhumorAdapterTests {
  @Test
  void hotListAndDetailUseSeparateParsers() {
    var adapter = SiteAdapters.require("TODAYHUMOR");
    URI listUrl = URI.create("https://www.todayhumor.co.kr/board/list.php?table=humorbest&page=1");
    String list = "<html><body><table><tr class='view'><td><a href='/board/view.php?table=humorbest&no=1797970&s_no=1797970&page=1'>title</a></td></tr></table>"
        + "<a href='/board/list.php?table=humorbest&page=2'>2</a></body></html>";
    var page = adapter.list(list.getBytes(StandardCharsets.UTF_8), listUrl);
    assertEquals(1, page.entries().size());
    assertEquals("humorbest:1797970", page.entries().getFirst().identity().postKey());
    assertEquals(URI.create("https://www.todayhumor.co.kr/board/list.php?table=humorbest&page=2"), page.next());

    URI detailUrl = URI.create("https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797970");
    SourcePolicy policy = new SourcePolicy(detailUrl.getHost(), List.of("/board/"), "meta[property=og:title],title", "img",
        "fixture contact-test", "TODAYHUMOR", Map.of("thimg.todayhumor.co.kr", List.of("/")));
    String detail = "<html><head><meta property='og:title' content='todayhumor fixture'>"
        + "<link rel='canonical' href='" + detailUrl + "'></head><body><div class='viewContent'>"
        + "<p>fixture body</p><img src='https://thimg.todayhumor.co.kr/upfile/a.jpg'>"
        + "<a href='https://x.com/fixture/status/123'>sns</a></div></body></html>";
    var result = adapter.detail(detail.getBytes(StandardCharsets.UTF_8), detailUrl, policy);
    assertEquals("todayhumor fixture", result.path("title").asText());
    assertEquals(1, result.path("imageCandidates").size());
    assertTrue(result.path("contentBlocks").toString().contains("x.com/fixture/status/123"));
  }
}
