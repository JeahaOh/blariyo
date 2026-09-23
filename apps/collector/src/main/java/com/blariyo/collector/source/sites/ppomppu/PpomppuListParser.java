package com.blariyo.collector.source.sites.ppomppu;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Entry;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.common.SiteParsingContext;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.isNoticeCandidate;
import static com.blariyo.collector.source.common.HtmlSupport.numericPage;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;

/** Offline list parsing for Ppomppu. */
public final class PpomppuListParser extends SiteParsingContext {
  public PpomppuListParser(PpomppuAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select("a[href*=/zboard/view.php][href*=id][href*=no]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item,.card"), a)) continue;
        var id = identify(url.resolve(a.attr("href")));
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = numericPage(url);
    for (var a : doc.select("a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        if (!candidate.getPath().equals(url.getPath()) || numericPage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }
}
