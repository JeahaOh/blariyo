package com.blariyo.collector.source.common;

import com.blariyo.collector.shared.CollectorFailure;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/** Shared HTML, date, query and notice handling; no site-specific dependencies. */
public final class HtmlSupport {
  private HtmlSupport() {}

  public static boolean isNoticeCandidate(Element row, Element link) {
    String marker = ((row == null ? "" : row.className() + " " + row.id() + " " + row.attr("data-type") + " " + row.attr("data-category"))
        + " " + link.className() + " " + link.attr("data-type") + " " + link.attr("data-category")).toLowerCase(Locale.ROOT);
    if (marker.matches(".*(?:^|[ _-])(notice|noti|notice-service|공지|fixed|sticky|pin|pinned)(?:$|[ _-]).*")) return true;
    Element badge = row == null ? null : row.selectFirst(".notice,.noti,.category,.badge,.label,.prefix,.ico_notice,.icon_notice,.gall_subject");
    String badgeText = badge == null ? "" : badge.text().strip();
    if (badgeText.matches("^(공지|알림|필독|NOTICE|Notice|notice)$")) return true;
    String title = link.text().replace('\u00a0', ' ').strip();
    return title.matches("^(\\[?\\s*(공지|알림|필독|운영|이벤트)\\s*\\]?|NOTICE|Notice|notice)(?:\\s|[:：\\]|-]).*");
  }

  public static int numericPage(URI url) {
    try { return Integer.parseInt(query(url).getOrDefault("page", "1")); }
    catch (NumberFormatException e) { return -1; }
  }

  public static Document parseHtml(byte[] bytes, URI url) {
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

  public static Instant instant(String text) {
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

  public static CollectorFailure invalid() { return new CollectorFailure(403, "SOURCE_URL_INVALID"); }
}
