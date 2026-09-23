package com.blariyo.collector.source.sites.humoruniv;

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

/** Offline list parsing for Humoruniv. */
public final class HumorunivListParser extends SiteParsingContext {
  public HumorunivListParser(HumorunivAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select("a[href*=read.html][href*=table][href*=number]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item,.card"), a)) continue;
        var id = identify(url.resolve(a.attr("href")));
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = huPage(url);
    for (var a : doc.select("a[href*=list.html][href*=page]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        var q = query(candidate);
        if (!candidate.getPath().endsWith("/list.html") || !q.getOrDefault("table", "").equals(query(url).getOrDefault("table", "")) || huPage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int huPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "0")); }
    catch (NumberFormatException e) { return -1; }
  }
}
