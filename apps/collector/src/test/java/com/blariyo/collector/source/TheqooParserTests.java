package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class TheqooParserTests {
  @Test void observedCdnImagesUseExactConfiguredOriginWithoutAllowingLookalikes() throws Exception {
    var source=SourceRegistry.read(java.nio.file.Path.of("ops/reference-sites.sources.example.json").toString()).key("theqoo");
    try(var fixture=getClass().getResourceAsStream("/sites/theqoo.detail.observed.html")) {
      assertNotNull(fixture);
      var parsed=source.adapter().detail(fixture.readAllBytes(),URI.create("https://theqoo.net/hot/4353582713"),source.policy());
      assertEquals(2,parsed.path("imageCandidates").size());
      assertEquals("https://img-cdn.theqoo.net/lOWOyN.jpg",parsed.path("imageCandidates").get(0).path("remoteUrl").asText());
      assertThrows(CollectorFailure.class,()->source.policy().imagePolicy("https://img-cdn.theqoo.net.evil.invalid/lOWOyN.jpg"));
    }
  }
  @Test void imageLimitIsDistinguishedFromChangedHtmlAndNeverTruncates() {
    var error=assertThrows(CollectorFailure.class,()->parse("<img src='https://img.theqoo.net/one.jpg'>".repeat(201)));
    assertEquals("SOURCE_IMAGE_LIMIT_EXCEEDED",error.getMessage());
  }
  private final SourcePolicy policy = SourcePolicy.from(Json.parse("""
      {"approved":true,"host":"theqoo.net","pathPrefixes":["/hot/"],"parser":"THEQOO",
       "userAgent":"fixture contact-test","imageOrigins":{"https://img.theqoo.net":["/"]}}
      """.getBytes(StandardCharsets.UTF_8)));
  private JsonNode parse(String body) {
    return policy.extract(("<title>원문 제목</title><article itemprop='articleBody'>" + body
        + "</article><footer>댓글 제외<img src='/ad.jpg'></footer>").getBytes(StandardCharsets.UTF_8),
        URI.create("https://theqoo.net/hot/123"));
  }
  @Test void orderedTextImagesAndSocialReferencesWithoutSummary() {
    var result = parse("""
      <p>첫 문단 &amp; 전체 본문</p><img data-original='https://img.theqoo.net/one.jpg' src='data:placeholder' alt='첫 사진'>
      <p>둘째 문단<br>줄바꿈</p><blockquote class='twitter-tweet'><p>임베드 대체 설명</p><a href='https://x.com/user/status/123'>날짜</a></blockquote>
      <iframe src='https://www.youtube.com/embed/Abcdefghijk'></iframe>
      <blockquote data-instgrm-permalink='https://www.instagram.com/p/ABC/'><p>fallback</p></blockquote>
      <blockquote cite='https://www.tiktok.com/@sample/video/123'><p>fallback</p></blockquote>
      """);
    var blocks = result.path("contentBlocks");
    assertEquals(7, blocks.size());
    assertEquals("첫 문단 & 전체 본문", blocks.get(0).path("text").asText());
    assertEquals("IMAGE", blocks.get(1).path("type").asText());
    assertEquals("둘째 문단\n줄바꿈", blocks.get(2).path("text").asText());
    assertEquals("https://x.com/user/status/123", blocks.get(3).path("url").asText());
    assertEquals("https://www.tiktok.com/@sample/video/123", blocks.get(6).path("url").asText());
    assertEquals(1, result.path("imageCandidates").size());
    assertFalse(result.toString().contains("fallback"));
    assertFalse(result.toString().contains("댓글 제외"));
  }
  @Test void textOnlyBareUrlsAndRepeatedImagesKeepTheirPositions() {
    assertEquals(0, parse("<p>글만 있음</p>").path("imageCandidates").size());
    var text = parse("<p>설명 https://youtu.be/Abcdefghijk 다음 설명</p>").path("contentBlocks");
    assertEquals(3, text.size());
    assertEquals("LINK", text.get(1).path("type").asText());
    var repeated = parse("<img src='https://img.theqoo.net/one.jpg'><p>중간</p><img src='https://img.theqoo.net/one.jpg'>");
    assertEquals(2, repeated.path("imageCandidates").size());
    assertEquals(2, repeated.path("contentBlocks").get(2).path("imagePosition").asInt());
  }
  @Test void missingBodyUnsafeAttachmentsAndLimitsFailWithoutTruncation() {
    for (var body : java.util.List.of("<script>only script</script>", "<img>",
        "<img src='https://img.theqoo.net.evil.invalid/one.jpg'>", "<iframe></iframe>",
        "<p>" + "가".repeat(20001) + "</p>", "<p>문단</p>".repeat(1001),
        "<img src='https://img.theqoo.net/one.jpg'>".repeat(201),
        "<div style=\"background-image:url(https://img.theqoo.net/one.jpg)\"></div>".repeat(201)))
      assertThrows(CollectorFailure.class, () -> parse(body));
    assertThrows(CollectorFailure.class, () -> policy.allow("https://img.theqoo.net/one.jpg"));
    assertThrows(CollectorFailure.class, () -> policy.imagePolicy("https://127.0.0.1/one.jpg"));
    assertThrows(CollectorFailure.class, () -> policy.imagePolicy("https://img.theqoo.net/../secret"));
    assertThrows(CollectorFailure.class, () -> policy.extract("<title>Missing</title>".getBytes(), URI.create("https://theqoo.net/hot/123")));
  }
}
