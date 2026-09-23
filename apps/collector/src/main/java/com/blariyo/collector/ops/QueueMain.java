package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.discord.DiscordGateway;
import com.blariyo.collector.run.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.*;
import java.util.*;
import org.springframework.core.env.*;

/** Independent batch JVM: no Spring application context, Core client, Quartz or HTTP API server. */
public final class QueueMain {
  public static void execute(String[] args)throws Exception {
    if (org.slf4j.LoggerFactory.getLogger("com.zaxxer.hikari") instanceof ch.qos.logback.classic.Logger logger)
      logger.setLevel(ch.qos.logback.classic.Level.WARN);
    boolean discord=args[0].equals("discord");
    var flags=new HashSet<String>();
    for(int i=1;i<args.length;i++)if(!Set.of("--once","--write-db").contains(args[i])||!flags.add(args[i]))throw new CollectorFailure(400,"BATCH_OPTIONS_INVALID");
    if(!flags.contains("--write-db")||(discord&&flags.contains("--once")))throw new CollectorFailure(400,"BATCH_MODE_REQUIRED");
    String config=System.getenv("COLLECTOR_CONFIG_FILE");if(config!=null&&!config.isBlank())OperatorSettings.load(config);
    String file=System.getenv().getOrDefault("COLLECTOR_SOURCE_CONFIG",OperatorSettings.get("collector.sources-file","COLLECTOR_SOURCES_FILE","apps/collector/ops/reference-sites.sources.example.json"));
    SourceRegistry.read(file);
    var hikari=new HikariConfig();hikari.setJdbcUrl(OperatorSettings.url());hikari.setUsername(OperatorSettings.user());hikari.setPassword(OperatorSettings.password());hikari.setMaximumPoolSize(4);
    try(var db=new HikariDataSource(hikari)) {
      var store=new BatchStore(db);var objects=BatchObjectStore.fromEnvironment();
      var worker=new BatchQueueWorker(store,()->SourceRegistry.read(file),new PinnedHttp(),objects);
      DiscordGateway gateway=null;
      if(discord) {
        var properties=new HashMap<String,Object>();properties.put("collector.sources-file",file);
        for(String field:List.of("guilds","channels","users","roles","register-commands")) {
          properties.put("collector.discord-"+field,OperatorSettings.get("collector.discord-"+field,"COLLECTOR_DISCORD_"+field.replace('-','_').toUpperCase(Locale.ROOT),field.equals("register-commands")?"false":""));
        }
        var env=new StandardEnvironment();env.getPropertySources().addFirst(new MapPropertySource("batch-discord",properties));
        gateway=new DiscordGateway(OperatorSettings.secrets(),null,env,store);
      }
      final var connected=gateway;
      Thread main=Thread.currentThread();
      Thread shutdown=new Thread(()->{main.interrupt();if(connected!=null)connected.close();},"batch-queue-shutdown");
      Runtime.getRuntime().addShutdownHook(shutdown);
      try {
        do {
          var result=worker.once();
          if(flags.contains("--once")||!result.outcome().equals("IDLE"))System.out.println(Json.tree(result));
          if(flags.contains("--once"))break;
          if(result.outcome().equals("IDLE"))Thread.sleep(1000);
        }while(!Thread.currentThread().isInterrupted());
      }catch(InterruptedException ignored){Thread.currentThread().interrupt();}
      finally {if(gateway!=null)gateway.close();try{Runtime.getRuntime().removeShutdownHook(shutdown);}catch(IllegalStateException ignored){}}
    }
  }
}
