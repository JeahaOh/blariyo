package com.blariyo.collector.source.sites.dcinside;

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

/** Offline list parsing for Dcinside. */
public final class DcinsideListParser extends SiteParsingContext {
  public DcinsideListParser(DcinsideAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select("tr.ub-content td.gall_tit a[href*=/board/view/], .gall_list a[href*=/board/view/]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div"), a)) continue;
        String href = a.attr("href").strip();
        if (href.startsWith("javascript:") || href.startsWith("#") || href.contains("#")) href = href.split("#", 2)[0];
        var id = identify(url.resolve(href));
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = dcPage(url);
    for (var a : doc.select(".bottom_paging_box a[href], .bottom_paging_wrap a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        var q = query(candidate);
        if (!candidate.getPath().startsWith("/board/lists") || !q.getOrDefault("id", "").equals(query(url).getOrDefault("id", "")) || dcPage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int dcPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
