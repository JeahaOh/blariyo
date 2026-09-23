package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.util.*;
import org.junit.jupiter.api.Test;

class SourceMediaLimitsTests {
  @Test void observedTodayhumorGalleryPreservesEveryImage() throws Exception {
    var uri=URI.create("https://www.todayhumor.co.kr/board/view.php?table=humorbest&no=1797973");
    var policy=new SourcePolicy(uri.getHost(),List.of("/"),"title","img","fixture contact.invalid",
        "TODAYHUMOR",Map.of("cdn.fixture.invalid",List.of("/")));
    try(var fixture=getClass().getResourceAsStream("/sites/todayhumor.gallery.observed.html")) {
      assertNotNull(fixture);
      var result=SiteAdapters.require("TODAYHUMOR").detail(fixture.readAllBytes(),uri,policy);
      assertEquals(21,result.path("imageCandidates").size());assertEquals(21,result.path("contentBlocks").size());
      for(int i=0;i<21;i++)assertEquals("https://cdn.fixture.invalid/observed-"+(i+1)+".png",result.path("imageCandidates").get(i).path("remoteUrl").asText());
    }
  }
  @Test void boundedConfigAndTwoHundredImageBoundaryPreserveOrder() {
    for (var invalid : List.of(Map.of("maxImages",201),Map.of("maxImages",0),Map.of("maxFileBytes",31457281),
        Map.of("maxTotalBytes",157286401),Map.of("maxImages","20"),Map.of("maxImages",1.5),Map.of("unknown",1)))
      assertThrows(CollectorFailure.class, () -> SourceMediaLimits.from(Json.tree(invalid)));
    var uri=URI.create("https://fixture.invalid/123");
    var base=new SourcePolicy(uri.getHost(),List.of("/"),"title","img","fixture contact.invalid");
    var parser=new OrderedContentParser(base);
    String images=java.util.stream.IntStream.rangeClosed(1,200)
        .mapToObj(i->"<img src='https://fixture.invalid/"+i+".png'>").collect(java.util.stream.Collectors.joining());
    String html="<title>gallery</title><article><p>before</p>"+images+"<p>after</p></article>";
    var result=parser.extract(html.getBytes(),uri,"article","title","fixture");
    assertEquals(200,result.path("imageCandidates").size());
    assertEquals("before",result.path("contentBlocks").get(0).path("text").asText());
    assertEquals("after",result.path("contentBlocks").get(201).path("text").asText());
    for(int i=1;i<=200;i++)assertEquals(i,result.path("contentBlocks").get(i).path("imagePosition").asInt());
    assertEquals("SOURCE_IMAGE_LIMIT_EXCEEDED",assertThrows(CollectorFailure.class,()->parser.extract(
        html.replace("</article>","<img src='https://fixture.invalid/201.png'></article>").getBytes(),uri,"article","title","fixture")).getMessage());
    var lower=new SourcePolicy(base.host(),base.pathPrefixes(),"title","img",base.userAgent(),"METADATA",Map.of(),List.of(),new SourceMediaLimits(20,100,100));
    assertThrows(CollectorFailure.class,()->new OrderedContentParser(lower).extract(html.getBytes(),uri,"article","title","fixture"));
  }
}
