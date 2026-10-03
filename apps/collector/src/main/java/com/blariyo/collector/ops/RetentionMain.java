package com.blariyo.collector.ops;

import com.blariyo.collector.maintenance.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.storage.RetentionObjects;
import com.zaxxer.hikari.*;
import java.util.*;

/** Explicit standalone retention command; the collecting PC and its credentials are not required. */
public final class RetentionMain {
  public static void execute(String[] args)throws Exception {
    if(org.slf4j.LoggerFactory.getLogger("com.zaxxer.hikari") instanceof ch.qos.logback.classic.Logger logger)
      logger.setLevel(ch.qos.logback.classic.Level.WARN);
    var flags=new HashSet<String>();
    for(int i=1;i<args.length;i++)if(!Set.of("--once","--write-db","--dry-run","--restore-inventory").contains(args[i]) || !flags.add(args[i]))
      throw new CollectorFailure(400,"RETENTION_OPTIONS_INVALID");
    if(flags.contains("--write-db")==flags.contains("--dry-run") ||
      (flags.contains("--restore-inventory") && (!flags.contains("--once") || !flags.contains("--write-db"))))
      throw new CollectorFailure(400,"RETENTION_MODE_REQUIRED");
    var env=System.getenv();
    if(!"blariyo_collect_retention".equals(env.get("COLLECTOR_RETENTION_DB_USER")))
      throw new CollectorFailure(503,"RETENTION_DATABASE_ROLE_REQUIRED");
    for(String key:List.of("COLLECTOR_RETENTION_DB_URL","COLLECTOR_RETENTION_DB_PASSWORD"))
      if(env.getOrDefault(key,"").isBlank())throw new CollectorFailure(503,"RETENTION_DATABASE_REQUIRED");
    var config=new HikariConfig();config.setJdbcUrl(env.get("COLLECTOR_RETENTION_DB_URL"));
    config.setUsername(env.get("COLLECTOR_RETENTION_DB_USER"));config.setPassword(env.get("COLLECTOR_RETENTION_DB_PASSWORD"));
    config.setMaximumPoolSize(3);config.setConnectionTimeout(10000);
    try(var db=new HikariDataSource(config)) {
      if(flags.contains("--dry-run")) {
        try(var c=db.getConnection();var sql=c.createStatement();var r=sql.executeQuery("SELECT * FROM collect.retention_preview()")) {
          r.next();System.out.println(Json.tree(Map.of("mode","DRY_RUN","due",r.getLong("due"),
            "failed",r.getLong("failed"),"backupGate",r.getBoolean("backup_gate"))));
        }
        return;
      }
      var worker=new BatchRetentionWorker(new RetentionRepository(db),RetentionObjects.fromEnvironment(env),System.err::println);
      do {
        var result=worker.once(flags.contains("--restore-inventory"));
        System.out.println(Json.tree(result));
        if(result.failed()>0)throw new CollectorFailure(503,"BATCH_RETENTION_FAILED");
        if(flags.contains("--once"))return;
        Thread.sleep(60000);
      } while(!Thread.currentThread().isInterrupted());
    }
  }
}
