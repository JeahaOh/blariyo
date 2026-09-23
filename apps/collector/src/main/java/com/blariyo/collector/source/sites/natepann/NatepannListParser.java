package com.blariyo.collector.source.sites.natepann;

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

/** Offline list parsing for Natepann. */
public final class NatepannListParser extends SiteParsingContext {
  public NatepannListParser(NatepannAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select("a[href^=/talk/], a[href^=https://pann.nate.com/talk/]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item,.card"), a)) continue;
        var id = identify(url.resolve(a.attr("href")));
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = natePage(url);
    for (var a : doc.select("a.paging[href], .paginate a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        if (!candidate.getPath().equals(url.getPath()) || natePage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private int natePage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
