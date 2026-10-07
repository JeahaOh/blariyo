package com.blariyo.collector.source.sites.humoruniv;

import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.DetailParserContract;
import java.net.URI;
import java.nio.charset.Charset;
import com.blariyo.collector.source.common.SiteFixtureSupport;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import tools.jackson.databind.JsonNode;

class HumorunivDetailParserTests extends DetailParserContract {
  HumorunivDetailParserTests() { super("humoruniv", ".daum-wm-content"); }
  @Override protected JsonNode parse(byte[] html, URI url, SourcePolicy policy) {
    return new HumorunivDetailParser(new HumorunivAdapter()).parse(html, url, policy);
  }
  @Override protected String body(String html) { return "<p class='content_body_padding'></p>" + html; }

  @ParameterizedTest
  @ValueSource(strings = {"EUC-KR", "UTF-8"})
  void preservesKoreanWhenMobileDocumentDeclaresHttpEquivCharset(String encoding) throws Exception {
    var f = SiteFixtureSupport.fixture("humoruniv", "detail");
    String html = "<html><head><meta http-equiv='Content-Type' content='text/html; charset=" + encoding
        + "'><meta property='og:title' content='웃긴대학 한글 제목'><title>웃긴대학 한글 제목</title></head>"
        + "<body><div class='daum-wm-content'><p class='content_body_padding'>첫 번째 본문</p>"
        + "<div class='body_editor'><img src='https://cdn.fixture.invalid/one.png' alt='사진 설명'>"
        + "<p>두 번째 본문</p></div></div></body></html>";
    var result = parse(html.getBytes(Charset.forName(encoding)), f.url(), f.policy());
    assertEquals("웃긴대학 한글 제목", result.path("title").asText());
    assertEquals("첫 번째 본문", result.path("contentBlocks").get(0).path("text").asText());
    assertEquals("사진 설명", result.path("contentBlocks").get(1).path("alt").asText());
    assertEquals("두 번째 본문", result.path("contentBlocks").get(2).path("text").asText());
    assertFalse(result.toString().contains("\ufffd"));
  }
}
