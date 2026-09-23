package com.blariyo.collector.source.sites.humoruniv;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SiteAdapter.Identity;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.HtmlDetailParser;
import com.blariyo.collector.source.common.OrderedContentParser;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.jsoup.nodes.Document;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Offline ordered detail parsing for Humoruniv. */
public final class HumorunivDetailParser extends HtmlDetailParser {
  public HumorunivDetailParser(HumorunivAdapter adapter) {
    super(adapter, "humoruniv-ordered-v1");
  }

  protected String body() { return ".daum-wm-content"; }

  protected String dateSelector() { return "time[datetime], .date, .regdate"; }

  @Override public JsonNode parse(byte[] bytes, URI url, SourcePolicy policy) {
    Identity requested = identify(url);
    Document doc = parseHtml(bytes, url);
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
}
