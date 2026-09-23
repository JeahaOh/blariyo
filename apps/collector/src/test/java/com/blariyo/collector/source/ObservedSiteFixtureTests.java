package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.file.*;
import java.util.*;
import org.jsoup.Jsoup;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;

/** Real captured HTML regressions. These tests do not claim current network or DB availability. */
class ObservedSiteFixtureTests {
  private static final Path ROOT=Path.of("src/test/resources/sites/observed");
  private record Fixture(byte[] bytes, JsonNode manifest, URI url, SourceRegistry.Source source) {}
  @org.junit.jupiter.api.Test
  void humorunivMobilePreservesTextOutsideAutoClosedParagraphAndMixedMedia()throws Exception {
    var f=fixture("humoruniv","detail");var doc=Jsoup.parse(new String(f.bytes,java.nio.charset.StandardCharsets.UTF_8));
    var body=doc.selectFirst(".daum-wm-content");assertNotNull(body);
    body.html("<p class='content_body_padding'>before</p><div class='body_editor'>"
        +"<div id='btn_nemo_expand_all'>expand control</div><div id='timg_prog_123'><img src='https://cdn.fixture.invalid/loading_bar.gif'></div>"
        +"<img src='https://cdn.fixture.invalid/one.png'><p>between</p><img src='https://cdn.fixture.invalid/two.png'><p>after</p>"
        +"<blockquote class='twitter-tweet'><a href='https://x.com/fixture/status/123'>tweet</a></blockquote>"
        +"<iframe src='https://www.youtube.com/embed/Abcdefghijk'></iframe>"
        +"<blockquote data-instgrm-permalink='https://www.instagram.com/p/Abcd/'></blockquote>"
        +"<a href='https://www.tiktok.com/@fixture/video/123'>video</a>"
        +"<a href='https://cdn.fixture.invalid/file.pdf'>document</a></div>");
    var policy=ObservedFixtureMain.fixturePolicy(f.source);
    var parsed=f.source.adapter().detail(doc.outerHtml().getBytes(java.nio.charset.StandardCharsets.UTF_8),f.url,policy);
    assertEquals(List.of("TEXT","IMAGE:1","TEXT","IMAGE:2","TEXT","LINK","LINK","LINK","LINK","LINK"),ObservedFixtureMain.shape(parsed));
    assertEquals("before",parsed.path("contentBlocks").get(0).path("text").asText());
    assertEquals("between",parsed.path("contentBlocks").get(2).path("text").asText());
    assertEquals("after",parsed.path("contentBlocks").get(4).path("text").asText());
    assertEquals(1,parsed.path("attachmentCandidates").size());
    assertFalse(parsed.toString().contains("expand control"));assertFalse(parsed.toString().contains("loading_bar"));
    body.html("<p class='content_body_padding'></p><div class='body_editor'><a href='https://x.com/fixture/status/123'>link only</a></div>");
    assertEquals(List.of("LINK"),ObservedFixtureMain.shape(f.source.adapter().detail(doc.outerHtml().getBytes(java.nio.charset.StandardCharsets.UTF_8),f.url,policy)));
    body.html("<p class='content_body_padding'>text only</p>");
    assertEquals(List.of("TEXT"),ObservedFixtureMain.shape(f.source.adapter().detail(doc.outerHtml().getBytes(java.nio.charset.StandardCharsets.UTF_8),f.url,policy)));
    body.html("<p class='content_body_padding'></p>");
    assertThrows(CollectorFailure.class,()->f.source.adapter().detail(doc.outerHtml().getBytes(java.nio.charset.StandardCharsets.UTF_8),f.url,policy));
  }
  private Fixture fixture(String source,String kind)throws Exception {
    Path path=ROOT.resolve(source+"."+kind+".html");
    byte[] bytes=Files.readAllBytes(path);
    JsonNode manifest=Json.parse(Files.readAllBytes(Path.of(path+".json")));
    assertEquals(source,manifest.path("source").asText());
    assertEquals(kind,manifest.path("kind").asText());
    assertEquals(Json.sha(bytes),manifest.path("fixtureSha256").asText());
    assertTrue(manifest.path("rawSha256").asText().matches("[a-f0-9]{64}"));
    var doc=Jsoup.parse(new String(bytes,java.nio.charset.StandardCharsets.UTF_8));
    assertTrue(doc.select("script,style,noscript,template").isEmpty());
    for(var el:doc.getAllElements())for(var attr:el.attributes()) {
      assertFalse(attr.getKey().startsWith("on"),"executable attribute");
      assertFalse(Set.of("value","nonce","action","formaction").contains(attr.getKey()),"non-structural private value");
    }
    return new Fixture(bytes,manifest,URI.create(manifest.path("url").asText()),SourceRegistry.read("ops/reference-sites.sources.example.json").key(source));
  }
  @ParameterizedTest
  @ValueSource(strings={"arcalive","bobaedream","clien","dcinside","dmitory","dogdrip","etoland","goodgag","humoruniv","instiz","inven","mlbpark","natepann","ruliweb","theqoo","todayhumor","yuldo"})
  void capturedDetailPreservesObservedBlockOrderAndMedia(String source)throws Exception {
    var f=fixture(source,"detail");
    var parsed=f.source.adapter().detail(f.bytes,f.url,ObservedFixtureMain.fixturePolicy(f.source));
    var expected=new ArrayList<String>();f.manifest.path("shape").forEach(n->expected.add(n.asText()));
    assertFalse(expected.isEmpty());
    assertEquals(expected,ObservedFixtureMain.shape(parsed));
    assertEquals(f.manifest.path("images").asInt(),parsed.path("imageCandidates").size());
    assertEquals(f.manifest.path("attachments").asInt(),parsed.path("attachmentCandidates").size());
    assertFalse(parsed.path("title").asText().isBlank());
    assertEquals(f.source.adapter().identify(f.url),f.source.adapter().identify(URI.create(parsed.path("canonicalUrl").asText())));
    String separator=f.url.getQuery()==null?"?":"&";
    assertEquals(f.source.adapter().identify(f.url),f.source.adapter().identify(URI.create(f.url+separator+"utm_source=fixture#comment")));
  }
  @ParameterizedTest
  @ValueSource(strings={"arcalive","bobaedream","clien","dcinside","dmitory","dogdrip","etoland","goodgag","humoruniv","instiz","inven","mlbpark","natepann","ruliweb","theqoo","todayhumor","yuldo"})
  void capturedListPreservesUniqueIdentitiesDatesAndPagination(String source)throws Exception {
    var f=fixture(source,"list");var page=f.source.adapter().list(f.bytes,f.url);
    var expected=new ArrayList<String>();f.manifest.path("entries").forEach(n->expected.add(n.asText()));
    assertFalse(expected.isEmpty());
    assertEquals(expected,page.entries().stream().map(e->e.identity().postKey()).toList());
    assertEquals(expected.size(),new HashSet<>(expected).size());
    assertEquals(f.manifest.path("next").asText(),Objects.toString(page.next(),""));
    var dates=new ArrayList<String>();f.manifest.path("identitiesAndDates").forEach(n->dates.add(n.asText()));
    assertEquals(dates,page.entries().stream().map(e->f.source.adapter().identify(e.identity().canonical()).canonical()+"|"+e.identity().postKey()+"|"+Objects.toString(e.publishedAt(),"")).toList());
    if(source.equals("etoland"))assertFalse(expected.stream().anyMatch(k->k.matches(".*:(2812904|2803717)")),"observed pinned notices must not enter discovery");
  }
}
