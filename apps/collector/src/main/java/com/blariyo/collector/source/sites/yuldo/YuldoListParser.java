package com.blariyo.collector.source.sites.yuldo;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Entry;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.common.SiteParsingContext;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.isNoticeCandidate;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import static com.blariyo.collector.source.common.HtmlSupport.query;

/** Offline list parsing for Yuldo. */
public final class YuldoListParser extends SiteParsingContext {
  public YuldoListParser(YuldoAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select(".list_body .list_title a.title[href]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item,.card"), a)) continue;
        var id = identify(url.resolve(a.attr("href")));
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = yuldoPage(url);
    for (var a : doc.select("a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        var q = query(candidate);
        if (!"/index.php".equals(candidate.getPath()) || !"humorissue".equals(q.getOrDefault("mid", "")) || yuldoPage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int yuldoPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
