package com.blariyo.collector.source.sites.instiz;

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

/** Offline list parsing for Instiz. */
public final class InstizListParser extends SiteParsingContext {
  public InstizListParser(InstizAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select("a[href*=/pt/]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item"), a)) continue;
        String href = a.attr("href").strip();
        if (href.startsWith("javascript:") || href.startsWith("#")) continue;
        URI candidate = url.resolve(href);
        var id = identify(candidate);
        if (!id.postKey().startsWith("pt:")) continue;
        found.putIfAbsent(id.postKey(), new Entry(new Identity(candidate, id.postKey()), null));
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = instizPage(url);
    for (var a : doc.select("a[href]")) {
      try {
        String href = a.attr("href").strip();
        if (href.startsWith("javascript:") || href.startsWith("#")) continue;
        URI candidate = url.resolve(href);
        check(candidate);
        if (!candidate.getPath().equals(url.getPath()) || instizPage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int instizPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
