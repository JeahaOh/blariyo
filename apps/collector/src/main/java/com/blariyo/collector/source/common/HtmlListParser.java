package com.blariyo.collector.source.common;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Entry;
import com.blariyo.collector.source.SiteAdapter.Page;
import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import static com.blariyo.collector.source.common.HtmlSupport.instant;
import static com.blariyo.collector.source.common.HtmlSupport.isNoticeCandidate;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import static com.blariyo.collector.source.common.HtmlSupport.query;

/** Shared ordered list traversal; concrete modules own selectors and pagination rules. */
public abstract class HtmlListParser extends SiteParsingContext {
  protected HtmlListParser(AbstractSiteAdapter adapter) { super(adapter); }
  protected abstract String links();
  protected abstract String row();
  protected abstract String pageParameter();
  protected boolean acceptListLink(Element a) { return true; }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select(links())) {
      if (!acceptListLink(a)) continue;
      var parent = a.closest(row());
      if (parent == null || isNoticeCandidate(parent, a)) continue;
      try {
        var id = identify(url.resolve(a.attr("href")));
        var date = parent.selectFirst("time[datetime]");
        Instant published = date == null ? null : instant(date.attr("datetime"));
        found.putIfAbsent(id.postKey(), new Entry(id, published));
      } catch (CollectorFailure ignored) { /* Navigation, unrelated board and adverts are not posts. */ }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = pageNumber(url);
    // Only observed links are followed. Never synthesize an unobserved next URL.
    for (var a : doc.select("a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        if (!candidate.getPath().equals(url.getPath()) || pageNumber(candidate) != current + 1) continue;
        var expected = query(url); expected.remove(pageParameter());
        var actual = query(candidate); actual.remove(pageParameter());
        if (actual.equals(expected)) { next = candidate; break; }
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int pageNumber(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault(pageParameter(), "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
