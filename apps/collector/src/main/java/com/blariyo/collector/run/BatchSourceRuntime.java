package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import java.sql.*;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Publishes only effective, allowlisted fields from the configuration actually loaded by this JVM. */
public final class BatchSourceRuntime {
  private final BatchStore store;
  private final UUID instance;
  public BatchSourceRuntime(BatchStore store,UUID instance){this.store=store;this.instance=instance;}
  public static JsonNode policy(SourceRegistry.Source source) {
    var config=source.config();var result=new TreeMap<String,Object>();
    var hosts=new TreeSet<String>();hosts.add(config.path("host").asText().toLowerCase(Locale.ROOT));
    config.path("hostAliases").forEach(value->hosts.add(value.asText().toLowerCase(Locale.ROOT)));
    String blocked=config.path("blockedReason").asText("");
    if(!blocked.isEmpty()&&!blocked.matches("[A-Z][A-Z0-9_]{0,99}"))blocked="SOURCE_NOT_ALLOWED";
    String collection=config.path("collectionPolicy").asText("UNVERIFIED");
    if(!Set.of("HOT_LIST","GENERAL_LIST","DETAIL_ONLY","BLOCKED","UNVERIFIED").contains(collection))
      throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    try{source.policy();}catch(CollectorFailure failure){blocked=failure.getMessage();}
    if(collection.equals("BLOCKED")||collection.equals("UNVERIFIED"))blocked="SOURCE_NOT_ALLOWED";
    Integer daily=config.hasNonNull("dailyRequestLimit")?integer(config,"dailyRequestLimit",1,1,1000000):null;
    if(daily==null&&blocked.isEmpty())blocked="SOURCE_CONFIG_REQUIRED";
    boolean enabled=config.path("approved").asBoolean(false)&&config.path("enabled").asBoolean(true)&&blocked.isEmpty();
    if(!enabled&&blocked.isEmpty())blocked="SOURCE_DISABLED";
    result.put("enabled",enabled);result.put("blockedReason",blocked.isEmpty()?null:blocked);
    result.put("collectionPolicy",collection);result.put("allowedHosts",List.copyOf(hosts));
    result.put("requestIntervalMs",integer(config,"requestIntervalMs",10000,10000,3600000));
    result.put("dailyRequestLimit",daily);result.put("maxPages",integer(config,"maxPages",2,1,10));
    result.put("maxItems",integer(config,"maxItems",20,1,100));
    result.put("mediaLimits",SourceMediaLimits.from(config.path("mediaLimits")));
    return Json.tree(result);
  }
  private static int integer(JsonNode config,String name,int fallback,int minimum,int maximum) {
    var value=config.path(name);if(value.isMissingNode())return fallback;
    if(!value.isIntegralNumber()||!value.canConvertToInt()||value.asInt()<minimum||value.asInt()>maximum)
      throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    return value.asInt();
  }
  public void publish(SourceRegistry registry) {
    try(var c=store.connection()) {
      c.setAutoCommit(false);
      try {
        for(var source:registry.sources()) {
          var config=source.config();var safe=policy(source);
          var identity=Map.of("normalizationVersion",1,"parser",config.path("parser").asText(),
              "pathPrefixes",config.path("pathPrefixes"),"policy",safe);
          String version=Json.sha(Json.canonical(Json.tree(identity)));
          try(var q=c.prepareStatement("""
            INSERT INTO collect.batch_source(source_key,host,policy_version,enabled,identity_parser,normalization_version,identity_hosts)
            VALUES(?,?,'runtime-v1',?,?,1,?) ON CONFLICT(source_key) DO UPDATE SET host=EXCLUDED.host,enabled=EXCLUDED.enabled,
            identity_parser=EXCLUDED.identity_parser,normalization_version=EXCLUDED.normalization_version,identity_hosts=EXCLUDED.identity_hosts,updated_at=clock_timestamp()
            """)) {
            q.setString(1,source.key());q.setString(2,config.path("host").asText().toLowerCase(Locale.ROOT));q.setBoolean(3,safe.path("enabled").asBoolean());
            q.setString(4,config.path("parser").asText());
            var hosts=new ArrayList<String>();safe.path("allowedHosts").forEach(v->hosts.add(v.asText()));
            q.setArray(5,c.createArrayOf("text",hosts.toArray()));q.executeUpdate();
          }
          try(var q=c.prepareStatement("""
            INSERT INTO collect.batch_source_runtime(instance_id,source_key,config_version,normalization_version,effective_policy)
            VALUES(?,?,?,1,?::jsonb) ON CONFLICT(instance_id,source_key) DO UPDATE
            SET config_version=EXCLUDED.config_version,normalization_version=EXCLUDED.normalization_version,effective_policy=EXCLUDED.effective_policy
            """)) {
            q.setObject(1,instance);q.setString(2,source.key());q.setString(3,version);q.setString(4,safe.toString());q.executeUpdate();
          }
        }
        // A successful reload removes this instance's withdrawn sources; other instances remain visible.
        try(var q=c.prepareStatement("DELETE FROM collect.batch_source_runtime WHERE instance_id=? AND NOT(source_key=ANY(?))")) {
          q.setObject(1,instance);q.setArray(2,c.createArrayOf("text",registry.sources().stream().map(SourceRegistry.Source::key).toArray()));q.executeUpdate();
        }
        c.commit();
      }catch(SQLException|RuntimeException error){c.rollback();throw error;}
    }catch(SQLException error){throw new CollectorFailure(503,"SOURCE_RUNTIME_WRITE_FAILED");}
  }
}
