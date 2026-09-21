package com.blariyo.collector.source;

import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.nio.file.*;
import java.util.*;
import org.jsoup.Jsoup;

/** Test bridge only. No network, no activation changes, no production jar entrypoint. */
public final class FixtureParserMain {
  public static void main(String[] args) throws Exception {
    String key = args[0]; URI url = URI.create(args[2]);
    byte[] bytes = Files.readAllBytes(Path.of(args[1]));
    // Approval is restricted to parsing already-captured bytes. It cannot perform an HTTP request.
    var origins = new HashMap<String,List<String>>();
    var doc = Jsoup.parse(new java.io.ByteArrayInputStream(bytes), null, url.toString());
    for (var image : doc.select("img")) for (String attr : List.of("src","data-src","data-original","data-lazy-src")) {
      try { URI remote=URI.create(image.absUrl(attr)); if(remote.getHost()!=null)origins.put(remote.getHost(),List.of("/")); }
      catch (IllegalArgumentException ignored) { }
    }
    var policy = new SourcePolicy(url.getHost(),List.of("/"),"meta[property=og:title],title","img","fixture contact-fixture.invalid",key.toUpperCase(Locale.ROOT),origins);
    System.out.println(SiteAdapters.require(key).detail(bytes,url,policy));
  }
}
