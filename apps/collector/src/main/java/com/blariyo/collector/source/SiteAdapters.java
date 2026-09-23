package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.common.HtmlSupport;
import com.blariyo.collector.source.sites.arcalive.ArcaliveAdapter;
import com.blariyo.collector.source.sites.bobaedream.BobaedreamAdapter;
import com.blariyo.collector.source.sites.clien.ClienAdapter;
import com.blariyo.collector.source.sites.dcinside.DcinsideAdapter;
import com.blariyo.collector.source.sites.dmitory.DmitoryAdapter;
import com.blariyo.collector.source.sites.dogdrip.DogdripAdapter;
import com.blariyo.collector.source.sites.etoland.EtolandAdapter;
import com.blariyo.collector.source.sites.fmkorea.FmkoreaAdapter;
import com.blariyo.collector.source.sites.goodgag.GoodgagAdapter;
import com.blariyo.collector.source.sites.humoruniv.HumorunivAdapter;
import com.blariyo.collector.source.sites.instiz.InstizAdapter;
import com.blariyo.collector.source.sites.inven.InvenAdapter;
import com.blariyo.collector.source.sites.mlbpark.MlbparkAdapter;
import com.blariyo.collector.source.sites.natepann.NatepannAdapter;
import com.blariyo.collector.source.sites.pgr21.Pgr21Adapter;
import com.blariyo.collector.source.sites.ppomppu.PpomppuAdapter;
import com.blariyo.collector.source.sites.ruliweb.RuliwebAdapter;
import com.blariyo.collector.source.sites.theqoo.TheqooAdapter;
import com.blariyo.collector.source.sites.todayhumor.TodayhumorAdapter;
import com.blariyo.collector.source.sites.youtubecommunity.YoutubeCommunityAdapter;
import com.blariyo.collector.source.sites.yuldo.YuldoAdapter;
import java.net.URI;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Registry composition only. Site rules belong to source.sites modules. */
public final class SiteAdapters {
  private SiteAdapters() {}
  public static SiteAdapter require(String key) {
    return switch (key.toUpperCase(Locale.ROOT)) {
      case "ARCALIVE" -> new ArcaliveAdapter();
      case "BOBAEDREAM" -> new BobaedreamAdapter();
      case "DOGDRIP" -> new DogdripAdapter();
      case "INVEN" -> new InvenAdapter();
      case "CLIEN" -> new ClienAdapter();
      case "DCINSIDE" -> new DcinsideAdapter();
      case "DMITORY" -> new DmitoryAdapter();
      case "ETOLAND" -> new EtolandAdapter();
      case "FMKOREA" -> new FmkoreaAdapter();
      case "GOODGAG" -> new GoodgagAdapter();
      case "HUMORUNIV" -> new HumorunivAdapter();
      case "INSTIZ" -> new InstizAdapter();
      case "MLBPARK" -> new MlbparkAdapter();
      case "NATEPANN" -> new NatepannAdapter();
      case "PGR21" -> new Pgr21Adapter();
      case "PPOMPPU" -> new PpomppuAdapter();
      case "RULIWEB" -> new RuliwebAdapter();
      case "THEQOO" -> new TheqooAdapter();
      case "TODAYHUMOR" -> new TodayhumorAdapter();
      case "YULDO" -> new YuldoAdapter();
      case "YOUTUBE_COMMUNITY" -> new YoutubeCommunityAdapter();
      default -> throw new CollectorFailure(403, "SITE_PARSER_UNVERIFIED");
    };
  }
  public static boolean supported(String key) {
    return Set.of("ARCALIVE", "BOBAEDREAM", "CLIEN", "DCINSIDE", "DMITORY", "DOGDRIP", "ETOLAND", "FMKOREA", "GOODGAG", "HUMORUNIV", "INSTIZ", "INVEN", "MLBPARK", "NATEPANN", "PGR21", "PPOMPPU", "RULIWEB", "THEQOO", "TODAYHUMOR", "YULDO", "YOUTUBE_COMMUNITY").contains(key.toUpperCase(Locale.ROOT));
  }


  public static Map<String, String> query(URI url) { return HtmlSupport.query(url); }
}
