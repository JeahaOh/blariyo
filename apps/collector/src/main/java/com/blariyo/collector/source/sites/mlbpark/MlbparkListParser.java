package com.blariyo.collector.source.sites.mlbpark;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Entry;
import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.common.SiteParsingContext;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.isNoticeCandidate;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import static com.blariyo.collector.source.common.HtmlSupport.query;

/** Offline list parsing for Mlbpark. */
public final class MlbparkListParser extends SiteParsingContext {
  public MlbparkListParser(MlbparkAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select("div.tit > a.txt[href]")) {
      try {
        if (isNoticeCandidate(a.closest(".list_item,[data-role=list-row],tr,li,div"), a)) continue;
        URI candidate = url.resolve(a.attr("href"));
        var id = identify(candidate);
        found.putIfAbsent(id.postKey(), new Entry(new Identity(candidate, id.postKey()), null));
      } catch (CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = pageNumber(url);
    for (var a : doc.select("a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        if (!"/mp/b.php".equals(candidate.getPath()) || pageNumber(candidate) != current + 1) continue;
        var q = query(candidate);
        if ("list".equals(q.getOrDefault("m", "")) && q.getOrDefault("b", "").equals(query(url).getOrDefault("b", ""))) { next = candidate; break; }
      } catch (CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int pageNumber(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("p", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
