package com.blariyo.collector.source.sites.etoland;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Entry;
import com.blariyo.collector.source.SiteAdapter.Page;
import com.blariyo.collector.source.common.SiteParsingContext;
import java.net.URI;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.regex.Pattern;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.invalid;
import static com.blariyo.collector.source.common.HtmlSupport.isNoticeCandidate;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import static com.blariyo.collector.source.common.HtmlSupport.query;

/** Offline list parsing for Etoland. */
public final class EtolandListParser extends SiteParsingContext {
  public EtolandListParser(EtolandAdapter adapter) { super(adapter); }

  public Page parse(byte[] bytes, URI url) {
    check(url);
    Document doc = parseHtml(bytes, url);
    var found = new LinkedHashMap<String, Entry>();
    String board = etolandBoard(url);
    // The current list nests titles in two divs; the notice category is a sibling in the li.
    // Collect identities first so repeated normal-list/comment links cannot reintroduce a pinned notice.
    var notices = new HashSet<String>();
    for(var a:doc.select("a[href*=/b/"+board+"/view/]")) {
      var row=a.closest("li,tr");
      if(row!=null&&row.select("a[href*=category]").stream().anyMatch(c->c.text().strip().matches("공지|알림|필독|광고")))
        try{notices.add(identify(url.resolve(a.attr("href").split("#",2)[0])).postKey());}catch(IllegalArgumentException|CollectorFailure ignored){}
    }
    for (var a : doc.select("a[href*=/b/" + board + "/view/]")) {
      try {
        if (isNoticeCandidate(a.closest("tr,li,div,.item"), a)) continue;
        String href = a.attr("href").strip();
        if (href.startsWith("javascript:") || href.startsWith("#")) continue;
        if (href.contains("#")) href = href.split("#", 2)[0];
        var id = identify(url.resolve(href));
        if(notices.contains(id.postKey()))continue;
        found.putIfAbsent(id.postKey(), new Entry(id, null));
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
    URI next = null;
    int current = etolandPage(url);
    for (var a : doc.select("a[href]")) {
      try {
        URI candidate = url.resolve(a.attr("href"));
        check(candidate);
        if (!candidate.getPath().equals(url.getPath()) || etolandPage(candidate) != current + 1) continue;
        next = candidate; break;
      } catch (IllegalArgumentException | CollectorFailure ignored) { }
    }
    return new Page(List.copyOf(found.values()), next);
  }

  private String etolandBoard(URI url) {
    var pretty = Pattern.compile("^/b/([A-Za-z0-9_]+)/list$").matcher(url.getPath());
    if (pretty.matches()) return pretty.group(1);
    String board = query(url).getOrDefault("bo_table", "");
    if ("/bbs/board.php".equals(url.getPath()) && board.matches("[A-Za-z0-9_]+")) return board;
    throw invalid();
  }

  private int etolandPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
}
