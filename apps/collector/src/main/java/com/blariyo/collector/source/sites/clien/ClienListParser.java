package com.blariyo.collector.source.sites.clien;

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

/** Offline list parsing for Clien. */
public final class ClienListParser extends SiteParsingContext {
  public ClienListParser(ClienAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    for (var a : doc.select(".list_item:not(.notice) a.list_subject[href], [data-role=list-row] a.list_subject[href]")) {
      try {
        if (isNoticeCandidate(a.closest(".list_item,[data-role=list-row],tr,li,div"), a)) continue;
        URI candidate = url.resolve(a.attr("href"));
        var id = identify(candidate);
        if (!id.postKey().startsWith("park:")) continue;
        found.putIfAbsent(id.postKey(), new Entry(new Identity(candidate, id.postKey()), null));
      } catch (CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    return new Page(List.copyOf(found.values()), null);
  }
}
