package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Explicit rules observed in public HTML on 2026-09-21. Unobserved sites never fall back to OG. */
public final class SiteAdapters {
  private SiteAdapters() {}
  public static SiteAdapter require(String key) {
    return switch (key.toUpperCase(Locale.ROOT)) {
      case "ARCALIVE" -> new Arcalive();
      case "BOBAEDREAM" -> new Bobaedream();
      case "DOGDRIP" -> new Dogdrip();
      case "INVEN" -> new Inven();
      case "CLIEN" -> new Clien();
      case "DCINSIDE" -> new Dcinside();
      case "DMITORY" -> new Dmitory();
      case "ETOLAND" -> new Etoland();
      case "FMKOREA" -> new Fmkorea();
      case "GOODGAG" -> new Goodgag();
      case "HUMORUNIV" -> new Humoruniv();
      case "INSTIZ" -> new Instiz();
      case "MLBPARK" -> new Mlbpark();
      case "NATEPANN" -> new Natepann();
      case "PGR21" -> new Pgr21();
      case "PPOMPPU" -> new Ppomppu();
      case "RULIWEB" -> new Ruliweb();
      case "THEQOO" -> new Theqoo();
      case "TODAYHUMOR" -> new Todayhumor();
      case "YULDO" -> new Yuldo();
      case "YOUTUBE_COMMUNITY" -> new YoutubeCommunity();
      default -> throw new CollectorFailure(403, "SITE_PARSER_UNVERIFIED");
    };
  }
  public static boolean supported(String key) {
    return Set.of("ARCALIVE", "BOBAEDREAM", "CLIEN", "DCINSIDE", "DMITORY", "DOGDRIP", "ETOLAND", "FMKOREA", "GOODGAG", "HUMORUNIV", "INSTIZ", "INVEN", "MLBPARK", "NATEPANN", "PGR21", "PPOMPPU", "RULIWEB", "THEQOO", "TODAYHUMOR", "YULDO", "YOUTUBE_COMMUNITY").contains(key.toUpperCase(Locale.ROOT));
  }


  private static boolean isNoticeCandidate(Element row, Element link) {
    String marker = ((row == null ? "" : row.className() + " " + row.id() + " " + row.attr("data-type") + " " + row.attr("data-category"))
        + " " + link.className() + " " + link.attr("data-type") + " " + link.attr("data-category")).toLowerCase(Locale.ROOT);
    if (marker.matches(".*(?:^|[ _-])(notice|noti|notice-service|공지|fixed|sticky|pin|pinned)(?:$|[ _-]).*")) return true;
    Element badge = row == null ? null : row.selectFirst(".notice,.noti,.category,.badge,.label,.prefix,.ico_notice,.icon_notice,.gall_subject");
    String badgeText = badge == null ? "" : badge.text().strip();
    if (badgeText.matches("^(공지|알림|필독|NOTICE|Notice|notice)$")) return true;
    String title = link.text().replace('\u00a0', ' ').strip();
    return title.matches("^(\\[?\\s*(공지|알림|필독|운영|이벤트)\\s*\\]?|NOTICE|Notice|notice)(?:\\s|[:：\\]|-]).*");
  }

  private abstract static class ManualSite implements SiteAdapter {
    abstract String host();
    abstract String body();
    abstract String dateSelector();
    String titleSelector() { return "meta[property=og:title],title"; }
    int maxBlocks() { return 1000; }
    void check(URI u) {
      if (!"https".equals(u.getScheme()) || !host().equalsIgnoreCase(u.getHost())
          || u.getUserInfo() != null || u.getPort() != -1 || u.getPath().contains("..")) throw invalid();
    }
    Identity identity(String path, String key) { return new Identity(URI.create("https://" + host() + path), key); }
    public Page list(byte[] bytes, URI url) { throw new CollectorFailure(403, "CHART_UNVERIFIED"); }
    public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      Identity requested = identify(url);
      Document doc = parse(bytes, url);
      Identity canonical = requested;
      var link = doc.selectFirst("link[rel=canonical][href]");
      if (link != null) {
        canonical = identify(url.resolve(link.attr("href")));
        if (!canonical.postKey().equals(requested.postKey())) throw invalid();
      }
      ObjectNode result = (ObjectNode) new OrderedContentParser(policy, maxBlocks(), policy.mediaLimits().maxImages()).extract(bytes, url,
          body(), titleSelector(), getClass().getSimpleName().toLowerCase(Locale.ROOT) + "-ordered-v1");
      result.put("canonicalUrl", canonical.canonical().toString());
      var date = doc.selectFirst(dateSelector());
      if (date != null) {
        Instant published = instant(date.hasAttr("datetime") ? date.attr("datetime") : date.text());
        if (published != null) result.put("sourcePublishedAt", published.toString());
      }
      return result;
    }
  }
  private abstract static class HtmlSite implements SiteAdapter {
    abstract String host();
    abstract String body();
    abstract String links();
    abstract String row();
    abstract String pageParameter();
    abstract String dateSelector();
    String titleSelector() { return "meta[property=og:title],title"; }
    int maxBlocks() { return 1000; }
    boolean acceptListLink(Element a) { return true; }
    void check(URI u) {
      if (!"https".equals(u.getScheme()) || !host().equalsIgnoreCase(u.getHost())
          || u.getUserInfo() != null || u.getPort() != -1 || u.getPath().contains("..")) throw invalid();
    }
    Identity identity(String path, String key) { return new Identity(URI.create("https://" + host() + path), key); }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    @Override public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      Identity requested = identify(url);
      Document doc = parse(bytes, url);
      Identity canonical = requested;
      var link = doc.selectFirst("link[rel=canonical][href]");
      if (link != null) {
        canonical = identify(url.resolve(link.attr("href")));
        if (!canonical.postKey().equals(requested.postKey())) throw invalid();
      }
      ObjectNode result = (ObjectNode) new OrderedContentParser(policy, maxBlocks(), policy.mediaLimits().maxImages()).extract(bytes, url,
          body(), titleSelector(), getClass().getSimpleName().toLowerCase(Locale.ROOT) + "-ordered-v1");
      result.put("canonicalUrl", canonical.canonical().toString());
      var date = doc.selectFirst(dateSelector());
      if (date != null) {
        Instant published = instant(date.hasAttr("datetime") ? date.attr("datetime") : date.text());
        if (published != null) result.put("sourcePublishedAt", published.toString());
      }
      return result;
    }
  }
  private static final class Arcalive extends HtmlSite {
    String host() { return "arca.live"; }
    String body() { return ".article-view .article-content"; }
    String links() { return ".article-list a.title[href]"; }
    String row() { return ".vrow"; }
    String pageParameter() { return "p"; }
    String dateSelector() { return ".article-head time[datetime]"; }
    int maxBlocks() { return 1000; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/b/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(2));
    }
  }
  private static final class Bobaedream extends HtmlSite {
    String host() { return "www.bobaedream.co.kr"; }
    String body() { return ".bodyCont[itemprop=articleBody]"; }
    String links() { return "a.bsubject[href]"; }
    String row() { return "tr"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return ".writerInfo03 .date"; }
    int maxBlocks() { return 1000; }
    public Identity identify(URI u) {
      check(u); var q = query(u); String board = q.getOrDefault("code", ""), id = q.getOrDefault("No", "");
      if (!Set.of("/view", "/board/bulletin/view.php").contains(u.getPath())
          || !board.matches("[a-zA-Z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
      return identity("/view?code=" + board + "&No=" + id, board + ":" + id);
    }
  }
  private static final class Dogdrip extends HtmlSite {
    String host() { return "www.dogdrip.net"; }
    String body() { return "div[class~=document_[0-9]+_0].xe_content"; }
    String links() { return "a.title-link[href]"; }
    String row() { return "tr,li,.card"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return ".article-head time[datetime]"; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/(?:dogdrip/)?([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity("/" + m.group(1), m.group(1));
    }
  }
  private static final class Inven extends HtmlSite {
    String host() { return "www.inven.co.kr"; }
    String body() { return "#powerbbsContent"; }
    String links() { return "a.subject-link[href],.open-issue-gallery a.link[href]"; }
    String row() { return "tr"; }
    String pageParameter() { return "p"; }
    String dateSelector() { return ".articleInfo .articleDate"; }
    @Override public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      var doc = parse(bytes, url);
      var articles = doc.select(body());
      if (articles.size() != 1) throw new CollectorFailure(422, "PARSE_FAILED");
      var files = new Element("div");
      // The observed download area belongs to this article but sits outside its body.
      for (var anchor : doc.select("#tbArticle > .articleFile a[href]")) {
        if (anchor.closest("#powerbbsContent") == null) {
          // The download icon is navigation chrome, not an attached article image.
          files.appendElement("a").attr("href", anchor.attr("href")).text(anchor.text());
          files.appendElement("br");
        }
      }
      if (files.childrenSize() > 0) articles.first().prependChild(files);
      doc.charset(StandardCharsets.UTF_8);
      var result = (ObjectNode) super.detail(doc.outerHtml().getBytes(StandardCharsets.UTF_8), url, policy);
      result.put("parserVersion", "inven-ordered-v2");
      return result;
    }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/board/([a-zA-Z0-9_]+)/([0-9]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1) + ":" + m.group(2) + ":" + m.group(3));
    }
  }

  private static final class Clien extends ManualSite {
    String host() { return "www.clien.net"; }
    String body() { return ".post_article, article .post-content, .board_read .content_view"; }
    String dateSelector() { return "time[datetime], .timestamp, .view_info .date"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/service/board/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1) + ":" + m.group(2));
    }
  }
  private static final class Dcinside extends ManualSite {
    String host() { return "gall.dcinside.com"; }
    String body() { return ".write_div, .writing_view_box .write_div, article .content"; }
    String dateSelector() { return "time[datetime], .gall_date, .date"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var q = query(u); String id = q.getOrDefault("id", ""), no = q.getOrDefault("no", "");
      if (!Set.of("/board/view/", "/mgallery/board/view/", "/mini/board/view/").contains(u.getPath())
          || !id.matches("[A-Za-z0-9_]+") || !no.matches("[0-9]+")) throw invalid();
      return identity(u.getPath() + "?id=" + id + "&no=" + no, id + ":" + no);
    }
  }
  private static final class Etoland extends ManualSite {
    String host() { return "etoland.co.kr"; }
    String body() { return "#bo_v_con, .view-content, .view_content, .board_view .content, .view-wrap .content, article .content"; }
    String dateSelector() { return "time[datetime], .if_date, .date"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var q = query(u); String table = q.getOrDefault("bo_table", ""), id = q.getOrDefault("wr_id", "");
      if ("/bbs/board.php".equals(u.getPath()) && table.matches("[A-Za-z0-9_]+") && id.matches("[0-9]+"))
        return identity("/bbs/board.php?bo_table=" + table + "&wr_id=" + id, table + ":" + id);
      var pretty = Pattern.compile("^/b/([A-Za-z0-9_]+)/view/.+-([0-9]+)$").matcher(u.getPath());
      if (pretty.matches()) return identity(u.getPath(), pretty.group(1) + ":" + pretty.group(2));
      throw invalid();
    }
  }
  private static final class Fmkorea extends ManualSite {
    String host() { return "www.fmkorea.com"; }
    String body() { return ".xe_content, .rd_body, article .content, .document-content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
      var found = new LinkedHashMap<String, Entry>();
      for (var a : doc.select("a[href]")) {
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
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/(?:best/)?([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity("/" + m.group(1), m.group(1));
    }
  }
  private static final class Goodgag extends ManualSite {
    String host() { return "www.goodgag.net"; }
    String body() { return ".content.issue, .xe_content, #bo_v_con, .view_content, article .content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var q = query(u); String document = q.getOrDefault("document_srl", q.getOrDefault("wr_id", ""));
      String board = q.getOrDefault("mid", q.getOrDefault("bo_table", "post"));
      if (("/bbs/board.php".equals(u.getPath()) || "/".equals(u.getPath())) && board.matches("[A-Za-z0-9_]+") && document.matches("[0-9]+"))
        return identity(u.getPath() + "?" + (q.containsKey("bo_table") ? "bo_table=" + board + "&wr_id=" + document : "mid=" + board + "&document_srl=" + document), board + ":" + document);
      var m = Pattern.compile("^/(?:[A-Za-z0-9_/-]+/)?([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1));
    }
  }
  private static final class Humoruniv extends ManualSite {
    String host() { return "web.humoruniv.com"; }
    String body() { return ".daum-wm-content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    void check(URI u) {
      if (!"https".equals(u.getScheme()) || !("web.humoruniv.com".equalsIgnoreCase(u.getHost()) || "m.humoruniv.com".equalsIgnoreCase(u.getHost()) || "humoruniv.com".equalsIgnoreCase(u.getHost()))
          || u.getUserInfo() != null || u.getPort() != -1 || u.getPath().contains("..")) throw invalid();
    }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    private URI mobileUrl(String key) {
      String[] parts = key.split(":", 2);
      return URI.create("https://m.humoruniv.com/board/read.html?table=" + parts[0] + "&number=" + parts[1]);
    }

    @Override public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      Identity requested = identify(url);
      Document doc = parse(bytes, url);
      var titleEl = doc.selectFirst("meta[property=og:title], title");
      String title = titleEl == null ? "" : titleEl.hasAttr("content") ? titleEl.attr("content") : titleEl.text();
      title = title.strip();
      if (title.isBlank()) throw new CollectorFailure(422, "PARSE_FAILED");
      var realMobileBody = doc.selectFirst("p.content_body_padding");
      if (realMobileBody == null) {
        ObjectNode result = (ObjectNode) new OrderedContentParser(policy, maxBlocks(), policy.mediaLimits().maxImages()).extract(bytes, url,
            "#cnts, #board_view, .view_content, .board-view-contents, article .content", titleSelector(), "humoruniv-ordered-fallback-v1");
        result.put("canonicalUrl", requested.canonical().toString());
        return result;
      }
      // Real mobile HTML puts body_editor beside the auto-closed p, not inside it.
      // Prune observed controls only, then preserve the entire article in DOM order.
      doc.select(".daum-wm-content #btn_nemo_expand_all, .daum-wm-content [id^=timg_prog_], .daum-wm-content img[src*=loading_bar]").remove();
      doc.charset(StandardCharsets.UTF_8);
      ObjectNode result = (ObjectNode) new OrderedContentParser(policy, maxBlocks(), policy.mediaLimits().maxImages()).extract(
          doc.outerHtml().getBytes(StandardCharsets.UTF_8), url, ".daum-wm-content", titleSelector(), "humoruniv-mobile-ordered-v2");
      result.put("canonicalUrl", requested.canonical().toString());
      return result;
    }
    public Identity identify(URI u) {
      check(u);
      var shortPath = Pattern.compile("^/([A-Za-z0-9_]+)([0-9]+)$").matcher(u.getPath());
      if (shortPath.matches()) return new Identity(mobileUrl(shortPath.group(1) + ":" + shortPath.group(2)), shortPath.group(1) + ":" + shortPath.group(2));
      var q = query(u); String table = q.getOrDefault("table", ""), number = q.getOrDefault("number", q.getOrDefault("pg", ""));
      if (!u.getPath().matches("^/board/(?:[A-Za-z0-9_/-]+/)?read\\.html$") || !table.matches("[A-Za-z0-9_]+") || !number.matches("[0-9]+")) throw invalid();
      return new Identity(URI.create("https://" + u.getHost() + u.getPath() + "?table=" + table + "&number=" + number), table + ":" + number);
    }
  }
  private static final class Instiz extends ManualSite {
    String host() { return "www.instiz.net"; }
    String body() { return "#memo_content_1, .memo_content, .post_content, article .content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1) + ":" + m.group(2));
    }
  }
  private static final class Mlbpark extends ManualSite {
    String host() { return "mlbpark.donga.com"; }
    String body() { return "#contentDetail, .ar_txt, .view_content, article .content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var q = query(u); String board = q.getOrDefault("b", ""), id = q.getOrDefault("id", "");
      if (!"/mp/b.php".equals(u.getPath()) || !"view".equals(q.getOrDefault("m", "")) || !board.matches("[A-Za-z0-9_]+") || !id.matches("[A-Za-z0-9_-]+")) throw invalid();
      return identity("/mp/b.php?m=view&b=" + board + "&id=" + id, board + ":" + id);
    }
  }
  private static final class Natepann extends ManualSite {
    String host() { return "pann.nate.com"; }
    String body() { return "div.viewarea > div.view-wrap > div.posting > table > tbody > tr > td > div#contentArea"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    int maxBlocks() { return 1000; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/talk/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1));
    }
  }
  private static final class Pgr21 extends ManualSite {
    String host() { return "pgr21.com"; }
    String body() { return ".viewContent, .post_content, #view_content, article .content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1) + ":" + m.group(2));
    }
  }
  private static final class Ppomppu extends ManualSite {
    String host() { return "www.ppomppu.co.kr"; }
    String body() { return ".board-contents, td.board-contents, #quote, article .content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
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
    public Identity identify(URI u) {
      check(u); var q = query(u); String id = q.getOrDefault("id", ""), no = q.getOrDefault("no", "");
      if (!"/zboard/view.php".equals(u.getPath()) || !id.matches("[A-Za-z0-9_]+") || !no.matches("[0-9]+")) throw invalid();
      return identity("/zboard/view.php?id=" + id + "&no=" + no, id + ":" + no);
    }
  }
  private static final class Ruliweb extends HtmlSite {
    String host() { return "bbs.ruliweb.com"; }
    String body() { return ".view_content[itemprop=articleBody], .view_content"; }
    String links() { return "#best_body a.subject_link[href*=/read/], .board_list_table a.subject_link[href*=/read/]"; }
    String row() { return "tr"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    String titleSelector() { return ".subject_inner_text, meta[property=og:title],title"; }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/(?:best/board|community/board|family/board|news/board|hobby/board)/([A-Za-z0-9_]+)/read/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1) + ":" + m.group(2));
    }
  }

  private static final class Theqoo extends HtmlSite {
    String host() { return "theqoo.net"; }
    String body() { return "article[itemprop=articleBody]"; }
    String links() { return "tbody.hide_notice tr:not(.notice) td.title > a[href^=/hot/], .theqoo_board_table tr:not(.notice) td.title > a[href^=/hot/], .bd_lst tr:not(.notice) td.title > a[href^=/hot/]"; }
    String row() { return "tr"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    boolean acceptListLink(Element a) {
      String text = a.text();
      return !text.contains("체험") && !text.contains("이벤트") && !text.contains("공지") && !text.contains("필독") && !text.contains("로그인 보안") && !text.contains("비밀번호") && !a.hasClass("replyNum");
    }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/(?:hot|square|talk)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1));
    }
    @Override public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      Identity requested = identify(url);
      ObjectNode result = (ObjectNode) new TheqooParser(policy).extract(bytes, url);
      result.put("canonicalUrl", requested.canonical().toString());
      return result;
    }
  }

  private static final class Todayhumor extends HtmlSite {
    String host() { return "www.todayhumor.co.kr"; }
    String body() { return "#viewContent, .viewContent, .board_view .content"; }
    String links() { return "a[href*=/board/view.php][href*=table][href*=no]"; }
    String row() { return "tr, .view"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return "time[datetime], .writerInfoContents .date, .date"; }
    public Identity identify(URI u) {
      check(u); var q = query(u); String table = q.getOrDefault("table", ""), id = q.getOrDefault("no", "");
      if (!"/board/view.php".equals(u.getPath()) || !table.matches("[a-zA-Z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
      return identity("/board/view.php?table=" + table + "&no=" + id, table + ":" + id);
    }
  }
  private static final class Yuldo extends ManualSite {
    String host() { return "yul-do.com"; }
    String body() { return ".xe_content, .rd_body, article .content, .document-content"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    @Override public Page list(byte[] bytes, URI url) {
      check(url);
      Document doc = parse(bytes, url);
      var found = new LinkedHashMap<String, Entry>();
      for (var a : doc.select(".list_body .list_title a.title[href]")) {
        try {
          if (isNoticeCandidate(a.closest("tr,li,div,.item,.card"), a)) continue;
          var id = identify(url.resolve(a.attr("href")));
          found.putIfAbsent(id.postKey(), new Entry(id, null));
        } catch (CollectorFailure ignored) { }
      }
      if (found.isEmpty()) throw new CollectorFailure(422, "LIST_STRUCTURE_CHANGED");
      URI next = null;
      int current = yuldoPage(url);
      for (var a : doc.select("a[href]")) {
        try {
          URI candidate = url.resolve(a.attr("href"));
          check(candidate);
          var q = query(candidate);
          if (!"/index.php".equals(candidate.getPath()) || !"humorissue".equals(q.getOrDefault("mid", "")) || yuldoPage(candidate) != current + 1) continue;
          next = candidate; break;
        } catch (CollectorFailure ignored) { }
      }
      return new Page(List.copyOf(found.values()), next);
    }
    private int yuldoPage(URI url) {
      try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
      catch (NumberFormatException e) { return -1; }
    }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/([A-Za-z0-9_/-]+)/([0-9]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1).replace('/', ':') + ":" + m.group(2));
    }
  }
  private static final class Dmitory extends HtmlSite {
    String host() { return "www.dmitory.com"; }
    String body() { return ".read_body .xe_content, #rd_body_content .xe_content"; }
    String links() { return "a.hx[href*=/issue/], a[href*=document_srl]"; }
    String row() { return "tr, li, .item"; }
    String pageParameter() { return "page"; }
    String dateSelector() { return "time[datetime], .date, .regdate"; }
    int maxBlocks() { return 1000; }
    public Identity identify(URI u) {
      check(u);
      var direct = Pattern.compile("^/([A-Za-z0-9_]+)/([0-9]+)$").matcher(u.getPath());
      if (direct.matches()) return identity(u.getPath(), direct.group(1) + ":" + direct.group(2));
      var root = Pattern.compile("^/([0-9]+)$").matcher(u.getPath());
      if (root.matches()) return identity("/issue/" + root.group(1), "issue:" + root.group(1));
      var q = query(u); String mid = q.getOrDefault("mid", ""), id = q.getOrDefault("document_srl", "");
      if (!"/index.php".equals(u.getPath()) || !mid.matches("[A-Za-z0-9_]+") || !id.matches("[0-9]+")) throw invalid();
      return identity("/" + mid + "/" + id, mid + ":" + id);
    }
  }

  private static final class YoutubeCommunity extends ManualSite {
    String host() { return "www.youtube.com"; }
    String body() { return "ytd-backstage-post-renderer #content-text, yt-formatted-string#content-text, #content-text, article .content"; }
    String dateSelector() { return "time[datetime], #published-time-text"; }
    @Override public JsonNode detail(byte[] bytes, URI url, SourcePolicy policy) {
      try { return super.detail(bytes, url, policy); }
      catch (CollectorFailure e) {
        if (!"PARSE_FAILED".equals(e.getMessage())) throw e;
        return fromInitialData(bytes, url, policy);
      }
    }
    private JsonNode fromInitialData(byte[] bytes, URI url, SourcePolicy policy) {
      Identity requested = identify(url);
      Document doc = parse(bytes, url);
      var titleEl = doc.selectFirst("meta[property=og:title], title");
      String title = titleEl == null ? "YouTube community post" : titleEl.hasAttr("content") ? titleEl.attr("content") : titleEl.text();
      title = title.strip();
      if (title.isBlank() || title.codePointCount(0, title.length()) > 300) throw new CollectorFailure(422, "PARSE_FAILED");
      for (var script : doc.select("script")) {
        String data = script.data();
        int start = data.indexOf("var ytInitialData = ");
        if (start < 0) continue;
        start += "var ytInitialData = ".length();
        int end = data.indexOf(";</script>", start);
        if (end < 0) end = data.lastIndexOf(';');
        if (end <= start) continue;
        try {
          JsonNode root = Json.parse(data.substring(start, end).getBytes(StandardCharsets.UTF_8));
          var posts = new ArrayList<JsonNode>(); collectNamed(root, "backstagePostRenderer", posts);
          for (var post : posts) {
            String text = runsText(post.path("contentText"));
            var images = new ArrayList<Map<String, Object>>();
            var blocks = new ArrayList<Map<String, Object>>();
            if (!text.isBlank()) blocks.add(Map.of("type", "TEXT", "text", text));
            var thumbnails = new ArrayList<String>(); collectThumbnailUrls(post, thumbnails);
            var seen = new LinkedHashSet<String>();
            for (String remote : thumbnails) {
              if (!seen.add(remote)) continue;
              policy.imagePolicy(remote).allow(remote);
              int position = images.size() + 1;
              images.add(Map.of("position", position, "remoteUrl", remote));
              blocks.add(Map.of("type", "IMAGE", "imagePosition", position, "alt", ""));
              if (images.size() > policy.mediaLimits().maxImages()) throw new CollectorFailure(422, "SOURCE_IMAGE_LIMIT_EXCEEDED");
            }
            if (blocks.isEmpty()) continue;
            var result = new LinkedHashMap<String, Object>();
            result.put("status", "NEW");
            result.put("title", title);
            result.put("canonicalUrl", requested.canonical().toString());
            result.put("sourcePublishedAt", null);
            result.put("parserVersion", "youtube-community-ytinitialdata-v1");
            result.put("warnings", List.of());
            result.put("imageCandidates", images);
            result.put("attachmentCandidates", List.of());
            result.put("contentBlocks", blocks);
            return Json.tree(result);
          }
        } catch (CollectorFailure ex) { throw ex; }
        catch (Exception ignored) { }
      }
      throw new CollectorFailure(422, "PARSE_FAILED");
    }
    private static void collectNamed(JsonNode node, String name, List<JsonNode> out) {
      if (node == null || node.isNull()) return;
      if (node.isObject()) {
        for (var entry : node.properties()) {
          if (entry.getKey().equals(name)) out.add(entry.getValue());
          collectNamed(entry.getValue(), name, out);
        }
      } else if (node.isArray()) for (var child : node) collectNamed(child, name, out);
    }
    private static String runsText(JsonNode node) {
      if (node.isMissingNode() || node.isNull()) return "";
      var out = new StringBuilder();
      if (!node.path("simpleText").asText("").isBlank()) out.append(node.path("simpleText").asText());
      for (var run : node.path("runs")) out.append(run.path("text").asText(""));
      return out.toString().strip();
    }
    private static void collectThumbnailUrls(JsonNode node, List<String> out) {
      if (node == null || node.isNull()) return;
      if (node.isObject()) {
        String url = node.path("url").asText("");
        if (url.startsWith("https://i.ytimg.com/") || url.startsWith("https://yt3.ggpht.com/")) out.add(url);
        for (var entry : node.properties()) collectThumbnailUrls(entry.getValue(), out);
      } else if (node.isArray()) for (var child : node) collectThumbnailUrls(child, out);
    }
    public Identity identify(URI u) {
      check(u); var m = Pattern.compile("^/post/([A-Za-z0-9_-]+)$").matcher(u.getPath());
      if (!m.matches()) throw invalid();
      return identity(u.getPath(), m.group(1));
    }
  }
  private static int numericPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }
  private static Document parse(byte[] bytes, URI url) {
    try {
      Document doc = Jsoup.parse(new java.io.ByteArrayInputStream(bytes), null, url.toString());
      String text = doc.text();
      String title = doc.title();
      if (looksLikeAccessChallenge(title, text)) throw new CollectorFailure(403, "SOURCE_ACCESS_BLOCKED");
      return doc;
    }
    catch (CollectorFailure e) { throw e; }
    catch (Exception e) { throw new CollectorFailure(422, "PARSE_FAILED"); }
  }
  private static boolean looksLikeAccessChallenge(String title, String text) {
    String sample = (title + "\n" + text).toLowerCase(Locale.ROOT);
    return sample.contains("연결 확인 중")
        || sample.contains("사람인지 확인")
        || sample.contains("checking if")
        || sample.contains("just a moment")
        || sample.contains("cloudflare") && sample.contains("turnstile")
        || sample.contains("access denied")
        || sample.contains("nginx") && sample.contains("403");
  }
  private static Instant instant(String text) {
    try { return Instant.parse(text); } catch (Exception ignored) { }
    try { return LocalDateTime.parse(text.strip(), java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm[:ss]")).atZone(ZoneId.of("Asia/Seoul")).toInstant(); }
    catch (Exception ignored) { return null; }
  }
  public static Map<String, String> query(URI u) {
    var result = new LinkedHashMap<String, String>();
    if (u.getRawQuery() == null) return result;
    for (String pair : u.getRawQuery().split("&")) {
      String[] values = pair.split("=", 2);
      String key = URLDecoder.decode(values[0], StandardCharsets.UTF_8);
      if (result.putIfAbsent(key, values.length == 1 ? "" : URLDecoder.decode(values[1], StandardCharsets.UTF_8)) != null) throw invalid();
    }
    return result;
  }
  private static CollectorFailure invalid() { return new CollectorFailure(403, "SOURCE_URL_INVALID"); }
}
