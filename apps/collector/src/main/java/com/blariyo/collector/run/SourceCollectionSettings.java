package com.blariyo.collector.run;

import com.blariyo.collector.source.*;
import com.blariyo.collector.shared.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import tools.jackson.databind.node.ObjectNode;

/** DB collection switches survive configuration reloads and are checked before each HTTP request. */
public final class SourceCollectionSettings {
  private final BatchStore store;
  public SourceCollectionSettings(BatchStore store){this.store=store;}
  static SourceRegistry.Source allowedConfig(SourceRegistry.Source source) {
    var copy=(ObjectNode)Json.parse(source.config().toString().getBytes(StandardCharsets.UTF_8));
    if(copy.path("blockedReason").asText("").equals("SOURCE_DISABLED")) {
      copy.put("approved",true);copy.put("blockedReason","");
    }
    copy.put("enabled",true);
    return new SourceRegistry.Source(source.key(),copy);
  }
  public void sync(SourceRegistry.Source source) {
    var config=source.config();var candidate=allowedConfig(source);
    String reason=null;
    try {
      candidate.policy();
      if(Set.of("BLOCKED","UNVERIFIED").contains(config.path("collectionPolicy").asText()))reason="SOURCE_NOT_ALLOWED";
    }catch(CollectorFailure failure){reason=failure.getMessage();}
    boolean available=reason==null;
    boolean initial=available&&config.path("approved").asBoolean(false)&&config.path("enabled").asBoolean(true)
        &&config.path("blockedReason").asText("").isBlank();
    String url=config.path("charts").path(config.path("defaultChart").asText("hot")).asText("");
    if(url.isBlank())for(var entry:config.path("charts").properties()){url=entry.getValue().asText("");if(!url.isBlank())break;}
    if(url.isBlank()&&!config.path("host").asText("").isBlank())url="https://"+config.path("host").asText()+"/";
    if(!url.isBlank()) {
      try {
        var uri=URI.create(url);var hosts=new HashSet<String>();hosts.add(config.path("host").asText().toLowerCase(Locale.ROOT));
        config.path("hostAliases").forEach(h->hosts.add(h.asText().toLowerCase(Locale.ROOT)));
        if(!Set.of("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null
            ||!hosts.contains(uri.getHost().toLowerCase(Locale.ROOT)))url="";
      }catch(IllegalArgumentException error){url="";}
    }
    try(var c=store.connection();var q=c.prepareStatement("SELECT collect.sync_source_collection_setting(?,?,?,?,?)")) {
      q.setString(1,source.key());q.setString(2,url.isBlank()?null:url);q.setBoolean(3,initial);q.setBoolean(4,available);q.setString(5,reason);q.execute();
    }catch(SQLException error){throw new CollectorFailure(503,"SOURCE_COLLECTION_SETTING_UNAVAILABLE");}
  }
  public boolean enabled(String source) {
    try(var c=store.connection();var q=c.prepareStatement("SELECT collection_enabled AND collection_available FROM collect.batch_source_collection_setting WHERE source_key=?")) {
      q.setString(1,source);try(var r=q.executeQuery()){if(!r.next())throw new CollectorFailure(503,"SOURCE_COLLECTION_SETTING_UNAVAILABLE");return r.getBoolean(1);}
    }catch(SQLException error){throw new CollectorFailure(503,"SOURCE_COLLECTION_SETTING_UNAVAILABLE");}
  }
  public void assertEnabled(String source) {
    try(var c=store.connection();var q=c.prepareStatement("SELECT collection_enabled,collection_available,blocked_reason FROM collect.batch_source_collection_setting WHERE source_key=?")) {
      q.setString(1,source);try(var r=q.executeQuery()) {
        if(!r.next())throw new CollectorFailure(503,"SOURCE_COLLECTION_SETTING_UNAVAILABLE");
        if(!r.getBoolean(2))throw new CollectorFailure(403,Objects.requireNonNullElse(r.getString(3),"SOURCE_NOT_ALLOWED"));
        if(!r.getBoolean(1))throw new CollectorFailure(403,"SOURCE_DISABLED");
      }
    }catch(SQLException error){throw new CollectorFailure(503,"SOURCE_COLLECTION_SETTING_UNAVAILABLE");}
  }
  public SourceRegistry.Source resolve(SourceRegistry.Source source) {
    sync(source);assertEnabled(source.key());return allowedConfig(source);
  }
  public SourceRegistry effective(SourceRegistry registry) {
    var result=Json.MAPPER.createObjectNode();
    for(var source:registry.sources()) {
      sync(source);var config=(ObjectNode)allowedConfig(source).config();
      if(!enabled(source.key())){config.put("enabled",false);config.put("blockedReason","SOURCE_DISABLED");}
      result.set(source.key(),config);
    }
    return new SourceRegistry(result);
  }
}
