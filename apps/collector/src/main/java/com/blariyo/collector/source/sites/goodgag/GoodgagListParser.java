package com.blariyo.collector.source.sites.goodgag;

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

/** Offline list parsing for Goodgag. */
public final class GoodgagListParser extends SiteParsingContext {
  public GoodgagListParser(GoodgagAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select(".list ul.photo li:not(.notice) p.subject > a[href]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item,.card"), a)) continue;
        var id = identify(url.resolve(a.attr("href")));
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    return new Page(List.copyOf(found.values()), null);
  }
}
