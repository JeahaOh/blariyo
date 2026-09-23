package com.blariyo.collector.source.sites.inven;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SourcePolicy;
import com.blariyo.collector.source.common.HtmlDetailParser;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.jsoup.nodes.Element;
import static com.blariyo.collector.source.common.HtmlSupport.parseHtml;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Offline ordered detail parsing for Inven. */
public final class InvenDetailParser extends HtmlDetailParser {
  public InvenDetailParser(InvenAdapter adapter) {
    super(adapter, "inven-ordered-v1");
  }

  protected String body() { return "#powerbbsContent"; }

  protected String dateSelector() { return ".articleInfo .articleDate"; }

  @Override public JsonNode parse(byte[] bytes, URI url, SourcePolicy policy) {
    var doc = parseHtml(bytes, url);
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
    var result = (ObjectNode) super.parse(doc.outerHtml().getBytes(StandardCharsets.UTF_8), url, policy);
    result.put("parserVersion", "inven-ordered-v2");
    return result;
  }
}
