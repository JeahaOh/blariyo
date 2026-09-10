package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;

class SecurityTests {
  @Test
  void privateSpecialAndMappedAddressesAreRejected() throws Exception {
    for (String ip :
        List.of(
            "127.0.0.1",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "224.0.0.1",
            "::1",
            "fc00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
            "2001:db8::1",
            "2002:7f00:1::1",
            "2001::1",
            "192.0.2.1",
            "198.51.100.1",
            "203.0.113.1",
            "3fff::1")) assertFalse(PinnedHttp.publicAddress(InetAddress.getByName(ip)), ip);
    for (String ip :
        List.of("8.8.8.8", "192.0.3.1", "198.51.101.1", "203.0.114.1", "2606:4700:4700::1111"))
      assertTrue(PinnedHttp.publicAddress(InetAddress.getByName(ip)), ip);
  }

  @Test
  void sourcePolicyRestrictsPathsAndParsesOnlySelectedImages() {
    var policy =
        new SourcePolicy(
            "fixture.invalid",
            List.of("/post/", "/image/"),
            "h1",
            "article img",
            "Blariyo/contact-test");
    URI uri = policy.allow("https://fixture.invalid/post/1");
    for (String value :
        List.of(
            "http://fixture.invalid/post/1",
            "https://else.invalid/post/1",
            "https://fixture.invalid:8443/post/1",
            "https://user:pass@fixture.invalid/post/1",
            "https://fixture.invalid/admin",
            "https://fixture.invalid/post/%2e%2e/admin"))
      assertThrows(CollectorFailure.class, () -> policy.allow(value));
    var result =
        policy.extract(
            "<h1>Hello</h1><article><img src='/image/1.png'><img src='/image/1.png'></article><img src='/tracking'>"
                .getBytes(),
            uri);
    assertEquals(1, result.path("imageCandidates").size());
    assertEquals("Hello", result.path("title").asText());
    assertFalse(policy.robotsAllows("User-agent: *\nDisallow: /post/", uri));
    assertFalse(policy.robotsAllows("User-agent: *\nUser-agent: Other\nDisallow: /post/", uri));
    assertTrue(
        policy.robotsAllows(
            "User-agent: Other\nDisallow: /post/\nUser-agent: *\nDisallow: /admin", uri));
  }
}
