package com.blariyo.collector.run;

import com.blariyo.collector.maintenance.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.storage.*;
import com.zaxxer.hikari.*;
import java.util.*;

/** Real worker, isolated PostgreSQL and filesystem; fault injection never calls an external service. */
public final class RetentionFixtureMain {
  public static void main(String[] args) {
    if (org.slf4j.LoggerFactory.getLogger("com.zaxxer.hikari") instanceof ch.qos.logback.classic.Logger logger)
      logger.setLevel(ch.qos.logback.classic.Level.WARN);
    var env=System.getenv();
    String url=env.get("RETENTION_FIXTURE_JDBC");
    if(url==null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:(55449|5439)/nest_[a-f0-9]{12}"))
      throw new IllegalArgumentException("ISOLATED_RETENTION_DATABASE_REQUIRED");
    var config=new HikariConfig();config.setJdbcUrl(url);config.setUsername(env.get("RETENTION_FIXTURE_USER"));
    config.setPassword(env.getOrDefault("RETENTION_FIXTURE_PASSWORD",""));config.setMaximumPoolSize(3);
    var local=new BatchObjectStore.Local(env.get("RETENTION_FIXTURE_DIRECTORY"));
    RetentionObjects objects=new RetentionObjects() {
      public Page list(String prefix,String token) { return local.list(prefix,token); }
      public void delete(String key) {
        if(key.equals(env.get("RETENTION_FIXTURE_FAIL_KEY")))throw new CollectorFailure(503,env.getOrDefault("RETENTION_FIXTURE_FAIL_CODE","OBJECT_FORBIDDEN"));
        local.delete(key);
        if(key.equals(env.get("RETENTION_FIXTURE_CRASH_KEY")))Runtime.getRuntime().halt(77);
      }
      public boolean exists(String key) { return local.exists(key); }
    };
    try(var db=new HikariDataSource(config)) {
      var alerts=new ArrayList<String>();
      var result=new BatchRetentionWorker(new RetentionRepository(db),objects,alerts::add)
          .once("true".equals(env.get("RETENTION_FIXTURE_RESTORE")));
      System.out.println(Json.tree(Map.of("purged",result.purged(),"failed",result.failed(),"alerts",alerts)));
    }
  }
}
