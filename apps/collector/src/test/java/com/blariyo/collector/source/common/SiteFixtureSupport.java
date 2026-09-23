package com.blariyo.collector.source.common;

import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.ObservedFixtureMain;
import com.blariyo.collector.source.SiteAdapter;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.SourceRegistry;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import tools.jackson.databind.JsonNode;

/** Offline inputs only. Synthetic blocked-site cases do not establish live support. */
public final class SiteFixtureSupport {
  private SiteFixtureSupport() {}
  public static final List<String> SITES = List.of("arcalive", "bobaedream", "clien", "dcinside",
      "dmitory", "dogdrip", "etoland", "fmkorea", "goodgag", "humoruniv", "instiz", "inven",
      "mlbpark", "natepann", "pgr21", "ppomppu", "ruliweb", "theqoo", "todayhumor", "yuldo", "youtube-community");
  public record Fixture(byte[] html, URI url, SiteAdapter adapter, SourcePolicy policy) {}

  public static Fixture fixture(String site, String kind) throws Exception {
    var source = SourceRegistry.read("ops/reference-sites.sources.example.json").key(site);
    Path path = Path.of("src/test/resources/sites/observed/" + site + "." + kind + ".html");
    if (Files.exists(path)) {
      var manifest = Json.parse(Files.readAllBytes(Path.of(path + ".json")));
      return new Fixture(Files.readAllBytes(path), URI.create(manifest.path("url").asText()),
          source.adapter(), ObservedFixtureMain.fixturePolicy(source));
    }
    String url = switch (site) {
      case "fmkorea" -> "https://www.fmkorea.com/1234567890";
      case "pgr21" -> "https://pgr21.com/humor/123456";
      case "ppomppu" -> "https://www.ppomppu.co.kr/zboard/view.php?id=freeboard&no=123456";
      case "youtube-community" -> "https://www.youtube.com/post/UgkxFixture123";
      default -> throw new IllegalArgumentException("Missing observed fixture: " + site);
    };
    String html;
    if (kind.equals("list")) {
      html = "<a href='" + url + "'>post</a><a href='" + url + "#comment'>duplicate</a>";
      if (site.equals("fmkorea")) url = "https://www.fmkorea.com/best";
      if (site.equals("ppomppu")) url = "https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard";
      html += "<a href='" + url + (url.contains("?") ? "&" : "?") + "page=2'>next</a>";
    } else {
      String body = "<p>before</p><img src='https://cdn.fixture.invalid/one.png'><p>after</p>"
          + "<blockquote class='twitter-tweet'><a href='https://x.com/fixture/status/123'>tweet</a></blockquote>"
          + "<a href='https://cdn.fixture.invalid/file.pdf'>attachment</a>";
      html = "<title>synthetic " + site + "</title><link rel='canonical' href='" + url + "'>";
      html += switch (site) {
        case "fmkorea" -> "<div class='xe_content'>" + body + "</div>";
        case "pgr21" -> "<div class='viewContent'>" + body + "</div>";
        case "ppomppu" -> "<div class='board-contents'>" + body + "</div>";
        default -> "<ytd-backstage-post-renderer><div id='content-text'>" + body + "</div></ytd-backstage-post-renderer>";
      };
    }
    return new Fixture(html.getBytes(StandardCharsets.UTF_8), URI.create(url), source.adapter(),
        ObservedFixtureMain.fixturePolicy(source));
  }

  public static JsonNode result(String site, String kind) throws Exception {
    var f = fixture(site, kind);
    if (kind.equals("detail")) return Json.tree(Map.of("identity", f.adapter.identify(f.url),
        "detail", f.adapter.detail(f.html, f.url, f.policy)));
    return Json.tree(f.adapter.list(f.html, f.url));
  }

  public static String fingerprint(String site, String kind) throws Exception {
    return Json.sha(Json.canonical(result(site, kind)));
  }

  public static String expected(String site, String kind) throws Exception {
    return Json.parse(Files.readAllBytes(Path.of("src/test/resources/sites/module-baseline.json")))
        .path(site).path(kind).asText();
  }

  /** Prints fingerprints for an explicit pre-refactor capture; never rewrites expectations. */
  public static void main(String[] args) throws Exception {
    var output = new TreeMap<String, Object>();
    for (String site : SITES) {
      var kinds = new TreeMap<String, String>();
      kinds.put("detail", fingerprint(site, "detail"));
      if (!List.of("pgr21", "youtube-community").contains(site)) kinds.put("list", fingerprint(site, "list"));
      output.put(site, kinds);
    }
    System.out.println(Json.tree(output).toPrettyString());
  }
}
