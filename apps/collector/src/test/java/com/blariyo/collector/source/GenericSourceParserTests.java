package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/** Verifies the reusable metadata parser used by non-specialized sources. */
class GenericSourceParserTests {
  @Test
  void extractsTitleAndImagesForRuliwebStyleSource() {
    var policy = SourcePolicy.from(Json.parse("""
        {"approved":true,"host":"bbs.ruliweb.com","pathPrefixes":["/etcs/board/"],
         "titleSelector":"meta[property='og:title']","imageSelector":"meta[property='og:image']",
         "parser":"METADATA","userAgent":"blariyo-collector contact-test",
         "imageOrigins":{"https://bbs.ruliweb.com":["/s/"]}}
        """.getBytes(StandardCharsets.UTF_8)));
    var result = policy.extract("""
        <html><head><meta property='og:title' content='루리웹 테스트 글'>
        <meta property='og:image' content='https://bbs.ruliweb.com/s/test.jpg'></head>
        <body>본문</body></html>
        """.getBytes(StandardCharsets.UTF_8),
        URI.create("https://bbs.ruliweb.com/etcs/board/10/read/123"));
    assertEquals("루리웹 테스트 글", result.path("title").asText());
    assertEquals("https://bbs.ruliweb.com/s/test.jpg",
        result.path("imageCandidates").get(0).path("remoteUrl").asText());
    assertEquals("jsoup-1.23.2-v1", result.path("parserVersion").asText());
  }
}
