package com.blariyo.collector.source;

import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import tools.jackson.databind.JsonNode;

/** Offline, opt-in fixture capture. Never fetches, writes DB, or retains source text/cookies/scripts. */
public final class ObservedFixtureMain {
  private static final Pattern URL=Pattern.compile("https?://[^\\s<>\"]+");
  private static final Pattern BACKGROUND=Pattern.compile("(?i)background(?:-image)?\\s*:\\s*url\\((['\"]?)(.*?)\\1\\)");
  private static final Set<String> ASSETS=Set.of("src","data-original","data-original-src","data-src","data-lazy-src","data-url","data-full","data-image","data-echo");
  private static final Set<String> STRUCTURE=Set.of("class","id","itemprop","rel","datetime","property","name","data-type","data-category");
  private static final Set<String> QUERY=Set.of("page","p","pn","mid","document_srl","wr_id","bo_table","id","no","No","code","m","b","table","sort_index","order_type","view_type","category","best_type","listType");
  private final SourceRegistry.Source source;
  private final URI base;
  private final Map<String,Integer> refs=new LinkedHashMap<>();
  private ObservedFixtureMain(SourceRegistry.Source source,URI base){this.source=source;this.base=base;}
  public static SourcePolicy fixturePolicy(SourceRegistry.Source source) {
    var p=source.policy();var origins=new LinkedHashMap<>(p.imageOrigins());origins.put("cdn.fixture.invalid",List.of("/"));
    return new SourcePolicy(p.host(),p.pathPrefixes(),p.titleSelector(),p.imageSelector(),p.userAgent(),p.parser(),origins,p.hostAliases(),p.mediaLimits());
  }
  private String asset(String value) {
    if(value.isBlank()||value.startsWith("data:")||value.startsWith("blob:"))return "data:image/png;base64,AA==";
    if(value.contains("loading_bar"))return "https://cdn.fixture.invalid/loading_bar.gif";
    return "https://cdn.fixture.invalid/image-"+refs.computeIfAbsent(base.resolve(value).toString(),ignored->refs.size()+1)+".png";
  }
  private String reference(String value) {
    if(value.isBlank()||value.startsWith("#")||value.startsWith("javascript:")||value.startsWith("mailto:")||value.startsWith("tel:"))return "#";
    try {
      URI u=base.resolve(value);
      if(!Set.of("http","https").contains(u.getScheme())||u.getHost()==null)return "#";
      try {
        var canonical=source.adapter().identify(u).canonical();
        return value.startsWith("/")?canonical.getRawPath()+(canonical.getRawQuery()==null?"":"?"+canonical.getRawQuery()):canonical.toString();
      }catch(CollectorFailure ignored){}
      if(u.getHost().equalsIgnoreCase(base.getHost())&&(u.getPath().equals(base.getPath())||u.getPath().equals("/index.php"))) {
        var query=new ArrayList<String>();
        for(String entry:Objects.toString(u.getRawQuery(),"").split("&"))if(QUERY.contains(entry.split("=",2)[0]))query.add(entry);
        String path=u.getRawPath()+(query.isEmpty()?"":"?"+String.join("&",query));
        return value.startsWith("/")?path:"https://"+u.getHost()+path;
      }
      int id=refs.computeIfAbsent(u.toString(),ignored->refs.size()+1);
      String host=u.getHost().toLowerCase(Locale.ROOT);
      if(Set.of("x.com","twitter.com","www.twitter.com").contains(host)&&u.getPath().contains("/status/"))return "https://x.com/fixture/status/"+(100000+id);
      if(host.contains("youtube.com")||host.equals("youtu.be"))return "https://www.youtube.com/watch?v=abcdefgh"+String.format("%03d",id);
      if(host.contains("instagram.com"))return "https://www.instagram.com/p/fixture"+id+"/";
      if(host.contains("tiktok.com"))return "https://www.tiktok.com/@fixture/video/"+(100000+id);
      var extension=Pattern.compile("(?i)[.](pdf|zip|7z|rar|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png|gif|webp|avif|mp4|webm)$").matcher(u.getPath());
      String suffix=extension.find()?"."+extension.group(1).toLowerCase(Locale.ROOT):"";
      return "https://cdn.fixture.invalid/reference-"+id+suffix;
    }catch(Exception ignored){return "#";}
  }
  private String words(String value) {
    if(value.replace('\u00a0',' ').isBlank())return value;
    String trimmed=value.strip();
    // Keep only dates, times and small pagination counters, never arbitrary numeric contact details.
    if(trimmed.matches("[0-9]{1,4}")||trimmed.matches("[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?")||
        trimmed.matches("(?:20[0-9]{2}[-./])?[0-9]{1,2}[-./][0-9]{1,2}(?:[ T][0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:Z|[+-][0-9]{2}:[0-9]{2})?)?"))return value;
    for(String marker:List.of("공지","필독","알림","광고","NOTICE","Notice","notice","이벤트","체험","비밀번호","로그인 보안"))
      if(value.contains(marker))return trimmed.equals(marker)?marker:marker+" fixture ";
    var matcher=URL.matcher(value);var out=new StringBuilder();int end=0;
    while(matcher.find()){
      if(!value.substring(end,matcher.start()).isBlank())out.append("fixture text ");
      String url=matcher.group().replaceAll("[),.!?]+$","");
      out.append(reference(url)).append(' ');end=matcher.start()+url.length();
    }
    if(!value.substring(end).isBlank())out.append("fixture text ");
    return out.isEmpty()?"fixture text ":out.toString();
  }
  private void clean(Node node) {
    if(node instanceof Comment){node.remove();return;}
    if(node instanceof TextNode text){text.text(words(text.getWholeText()));return;}
    if(node instanceof Element el) {
      if(Set.of("script","style","noscript","template").contains(el.normalName())){el.remove();return;}
      for(var attr:new ArrayList<>(el.attributes().asList())) {
        String key=attr.getKey(),value=attr.getValue();
        if(STRUCTURE.contains(key)) {
          if(key.equals("class")||key.equals("id"))el.attr(key,value.replaceAll("(?i)(member|user|profile|nick)[_-][^\\s]+","$1_fixture"));
          else if(key.equals("name")&&!el.normalName().equals("meta"))el.attr(key,"fixture");
          else if(key.equals("data-type")||key.equals("data-category"))el.attr(key,words(value));
        } else if(key.equals("href")||key.equals("cite")||key.equals("data-instgrm-permalink"))el.attr(key,reference(value));
        else if(ASSETS.contains(key))el.attr(key,el.normalName().equals("img")?asset(value):reference(value));
        else if(key.equals("srcset")||key.equals("data-srcset")) {
          var entries=new ArrayList<String>();for(String entry:value.split(",")){String[] parts=entry.strip().split("\\s+",2);entries.add(asset(parts[0])+(parts.length>1?" "+parts[1]:""));}el.attr(key,String.join(",",entries));
        }else if(key.equals("style")) {
          var m=BACKGROUND.matcher(value);if(m.find())el.attr(key,"background-image:url('"+asset(m.group(2))+"')");else el.removeAttr(key);
        }else if(key.equals("content")&&el.normalName().equals("meta")) {
          if(el.attr("property").equals("og:image"))el.attr(key,asset(value));
          else if(el.attr("property").equals("og:url"))el.attr(key,base.toString());
          else el.attr(key,words(value));
        }else if(key.equals("alt")||key.equals("aria-label")||key.equals("title"))el.attr(key,value.isBlank()?"":"fixture");
        else el.removeAttr(key);
      }
    }
    for(var child:new ArrayList<>(node.childNodes()))clean(child);
  }
  static List<String> shape(JsonNode parsed) {
    var result=new ArrayList<String>();for(var b:parsed.path("contentBlocks"))result.add(b.path("type").asText()+
        (b.path("type").asText().equals("IMAGE")?":"+b.path("imagePosition").asInt():""));return result;
  }
  private static List<String> entries(SourceRegistry.Source source, SiteAdapter.Page page) {
    return page.entries().stream().map(e -> source.adapter().identify(e.identity().canonical()).canonical()+"|"+
        e.identity().postKey()+"|"+Objects.toString(e.publishedAt(),"")).toList();
  }
  public static void main(String[] args)throws Exception {
    if(args.length!=5||!Set.of("list","detail").contains(args[1]))throw new IllegalArgumentException("source mode url raw-file output-file");
    var source=SourceRegistry.read("ops/reference-sites.sources.example.json").key(args[0]);var url=URI.create(args[2]);
    byte[] raw=Files.readAllBytes(Path.of(args[3]));var doc=Jsoup.parse(new java.io.ByteArrayInputStream(raw),null,url.toString());
    var sanitizer=new ObservedFixtureMain(source,url);sanitizer.clean(doc);doc.outputSettings().prettyPrint(false);
    // Match the repository's LF contract before hashing the sanitized fixture.
    String html=doc.outerHtml().replace("\r\n","\n").replace('\r','\n').replaceAll("(?m)[ \\t]+$","");
    html=java.util.regex.Pattern.compile("(?m)^[ \\t]+").matcher(html)
        .replaceAll(match->match.group().replace("\t","    "));
    byte[] fixture=(html.stripTrailing()+"\n").getBytes(StandardCharsets.UTF_8);
    var manifest=new LinkedHashMap<String,Object>();manifest.put("source",source.key());manifest.put("kind",args[1]);manifest.put("url",url.toString());
    manifest.put("rawSha256",Json.sha(raw));manifest.put("fixtureSha256",Json.sha(fixture));
    if(args[1].equals("list")) {
      var before=source.adapter().list(raw,url);var after=source.adapter().list(fixture,url);
      // Tracking query strings may be removed, but identity, ordering, dates and pagination must survive.
      if(!entries(source,before).equals(entries(source,after))||
          !sanitizer.reference(Objects.toString(before.next(),"")).equals(sanitizer.reference(Objects.toString(after.next(),""))))
        throw new IllegalStateException("LIST_SHAPE_CHANGED:"+before.entries().size()+":"+after.entries().size());
      manifest.put("entries",before.entries().stream().map(e->e.identity().postKey()).toList());manifest.put("next",Objects.toString(after.next(),""));
      manifest.put("identitiesAndDates",entries(source,before));
    }else {
      var before=source.adapter().detail(raw,url,source.policy());var after=source.adapter().detail(fixture,url,fixturePolicy(source));
      if(!shape(before).equals(shape(after))||before.path("imageCandidates").size()!=after.path("imageCandidates").size()||before.path("attachmentCandidates").size()!=after.path("attachmentCandidates").size())
        throw new IllegalStateException("DETAIL_SHAPE_CHANGED:"+shape(before)+":"+shape(after));
      manifest.put("shape",shape(before));manifest.put("images",after.path("imageCandidates").size());manifest.put("attachments",after.path("attachmentCandidates").size());
    }
    manifest.put("transformation","Observed HTML structure retained; scripts/comments/non-structural attributes removed; text and remote asset URLs replaced. Original vs sanitized parser structure checked before writing. This is not a live verification substitute.");
    Path output=Path.of(args[4]);Files.createDirectories(output.getParent());Files.write(output,fixture);
    Files.writeString(Path.of(output+".json"),Json.tree(manifest).toPrettyString()+"\n");
    System.out.println(Json.tree(Map.of("source",source.key(),"mode",args[1],"fixtureBytes",fixture.length,"state","CAPTURED")));
  }
}
