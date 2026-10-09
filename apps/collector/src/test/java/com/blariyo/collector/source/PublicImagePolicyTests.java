package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import java.net.URI;
import java.util.*;
import org.junit.jupiter.api.Test;

class PublicImagePolicyTests {
  private final SourcePolicy policy = new SourcePolicy("theqoo.net",List.of("/hot/"),"title","img","fixture contact", "THEQOO",Map.of());
  @Test void originalFailureShapesParseWithoutPerSourceImageOrigins() {
    for(String image:List.of("https://imgnews.pstatic.net/one.jpg","http://thimg.todayhumor.co.kr/one.jpg")) {
      var parsed=policy.extract(("<title>fixture</title><article itemprop='articleBody'><img src='"+image+"'></article>").getBytes(),URI.create("https://theqoo.net/hot/123"));
      assertEquals(image,parsed.path("imageCandidates").get(0).path("remoteUrl").asText());
      assertThrows(CollectorFailure.class,()->policy.allow(image));
      assertThrows(CollectorFailure.class,()->policy.attachmentPolicy(image));
    }
  }
  @Test void arbitraryPublicImageHostsAndDefaultPortsAreAllowedButUnsafeUrlsAreNot() {
    for(String value:List.of("http://cdn.invalid/x","https://cdn.invalid:443/x","http://cdn.invalid:80/x","https://another.invalid/new/path"))
      assertEquals(URI.create(value),policy.imagePolicy(value).allow(value));
    for(String value:List.of("file:///etc/passwd","https://user:pass@cdn.invalid/x","http://cdn.invalid:8080/x",
        "http://127.0.0.1/x","https://10.0.0.1/x","http://169.254.169.254/x","https://[::1]/x",
        "http://localhost/x","https://[fc00::1]/x","https://cdn.invalid/../private"))
      assertEquals("IMAGE_URL_NOT_ALLOWED",assertThrows(CollectorFailure.class,()->policy.imagePolicy(value),value).getMessage());
  }
}
