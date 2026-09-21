package com.blariyo.collector;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.PinnedHttp;
import com.blariyo.collector.source.SourceTransport;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.*;

public class FixtureApplication {
  public static void main(String[] args) {
    SpringApplication.run(
        new Class<?>[] {CollectorApplication.class, FixtureTransport.class}, args);
  }

  @Configuration
  @Profile("fixture")
  static class FixtureTransport {
    @Bean
    SourceTransport sourceTransport(org.springframework.core.env.Environment env) {
      return new SourceTransport() {
        public void validate(URI uri) {
          if (!uri.getHost().equals("fixture.invalid"))
            throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED");
        }

        public PinnedHttp.Response get(URI uri, int maximum, String userAgent) {
          validate(uri);
          if (uri.getPath().startsWith("/post/redirect/")) {
            int hop = Integer.parseInt(uri.getPath().substring("/post/redirect/".length()));
            return new PinnedHttp.Response(
                302,
                "text/html",
                Map.of("location", List.of("/post/redirect/" + (hop + 1))),
                new byte[0]);
          }
          if (uri.getPath().equals("/post/slow")) {
            try {
              Thread.sleep(5000);
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
              throw new CollectorFailure(409, "STOP_REQUESTED");
            }
          }
          if (uri.getPath().equals("/image/broken.png")
              && !env.getProperty("collector.fixture-images-recover", Boolean.class, false))
            return new PinnedHttp.Response(200, "image/png", Map.of(), new byte[] {1});
          byte[] bytes;
          String mime;
          if (uri.getPath().equals("/robots.txt")) {
            bytes = "User-agent: *\nAllow: /".getBytes(StandardCharsets.UTF_8);
            mime = "text/plain";
          } else if (uri.getPath().startsWith("/image/")) {
            bytes =
                Base64.getDecoder()
                    .decode(
                        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/aUAAAAASUVORK5CYII=");
            mime = "image/png";
          } else {
            bytes =
                "<title>Spring fixture</title><h1>Spring fixture</h1><article itemprop='articleBody'><p>원문 문단 전체</p><img src='/image/1.png' alt='원문 사진'><iframe src='https://www.youtube.com/embed/Abcdefghijk'></iframe></article>"
                    .getBytes(StandardCharsets.UTF_8);
            if (uri.getPath().equals("/post/partial"))
              bytes =
                  "<h1>Partial fixture</h1><article><img src='/image/1.png'><img src='/image/broken.png'></article>"
                      .getBytes(StandardCharsets.UTF_8);
            mime = "text/html";
          }
          return new PinnedHttp.Response(200, mime, Map.of(), bytes);
        }
      };
    }
  }
}
