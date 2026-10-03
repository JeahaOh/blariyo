package com.blariyo.collector.source;

import com.blariyo.collector.shared.Json;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Shared canonical URL/post-key golden vectors. This command has no transport or DB dependency. */
public final class DirectIdentityFixtureMain {
  public static void main(String[] args)throws Exception {
    if(args.length!=1)throw new IllegalArgumentException();
    var results=new ArrayList<Map<String,Object>>();
    for(var vector:Json.parse(Files.readAllBytes(Path.of(args[0])))) {
      try {
        var uri=URI.create(vector.path("url").asText());
        new SourcePolicy(uri.getHost(),List.of("/"),"","","fixture contact@example.invalid").allow(uri.toString());
        var identity=SiteAdapters.require(vector.path("parser").asText()).identify(uri);
        results.add(Map.of("canonicalUrl",identity.canonical().toString(),"postKey",identity.postKey(),"normalizationVersion",1));
      }catch(RuntimeException error){results.add(Map.of("error",true));}
    }
    System.out.println(Json.tree(results));
  }
}
