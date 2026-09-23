package com.blariyo.collector.source;

import com.blariyo.collector.source.common.OrderedContentParser;
import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class InvenAttachmentTests {
  @ParameterizedTest
  @CsvSource({"external,2,8,38", "repeated,1,2,9"})
  void observedArticleAttachmentsRemainOutsideAuthorAndCommentAreas(String sample,int files,int images,int blocks)throws Exception {
    var path=Path.of("src/test/resources/sites/observed/inven.attachments-"+sample+".html");
    byte[] bytes=Files.readAllBytes(path);
    var manifest=Json.parse(Files.readAllBytes(Path.of(path+".json")));
    assertEquals(Json.sha(bytes),manifest.path("fixtureSha256").asText());
    var source=SourceRegistry.read("ops/reference-sites.sources.example.json").key("inven");
    var url=URI.create(manifest.path("url").asText());
    var result=source.adapter().detail(bytes,url,ObservedFixtureMain.fixturePolicy(source));
    assertEquals(files,result.path("attachmentCandidates").size());
    assertEquals(images,result.path("imageCandidates").size());
    assertEquals(blocks,result.path("contentBlocks").size());
    var shapes=new ArrayList<String>();manifest.path("shape").forEach(n->shapes.add(n.asText()));
    assertEquals(shapes,ObservedFixtureMain.shape(result));
    for(int i=0;i<files;i++) {
      assertEquals("LINK",result.path("contentBlocks").get(i).path("type").asText());
      assertEquals(result.path("attachmentCandidates").get(i).path("remoteUrl").asText(),result.path("contentBlocks").get(i).path("url").asText());
    }
    assertEquals("inven-ordered-v2",result.path("parserVersion").asText());
  }

  @Test void bareFileReferencesAndRepeatedAnchorsDownloadOnceWithoutDroppingBodyLinks() {
    var url=URI.create("https://www.inven.co.kr/board/webzine/2097/123");
    var policy=new SourcePolicy(url.getHost(),List.of("/"),"title","img","fixture contact", "INVEN",Map.of());
    String file="https://www.inven.co.kr/file.zip";
    String html="<title>fixture</title><article><a href='"+file+"'>file</a><p>"+file+"</p><a href='"+file+"'>file again</a></article>";
    var parser=new OrderedContentParser(policy);
    var result=parser.extract(html.getBytes(StandardCharsets.UTF_8),url,"article","title","fixture");
    assertEquals(3,result.path("contentBlocks").size());
    assertEquals(1,result.path("attachmentCandidates").size());
    assertEquals(file,result.path("attachmentCandidates").get(0).path("remoteUrl").asText());
    assertEquals(1,parser.extract(html.getBytes(StandardCharsets.UTF_8),url,"article","title","fixture").path("attachmentCandidates").size());
    String many="<title>fixture</title><article>"+java.util.stream.IntStream.range(0,21).mapToObj(i->"<p>https://www.inven.co.kr/"+i+".pdf</p>").reduce("",String::concat)+"</article>";
    assertThrows(CollectorFailure.class,()->parser.extract(many.getBytes(StandardCharsets.UTF_8),url,"article","title","fixture"));
  }
}
