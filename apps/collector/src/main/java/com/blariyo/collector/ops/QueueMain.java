package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.discord.DiscordGateway;
import com.blariyo.collector.run.*;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
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
    var sources=new AtomicReference<>(SourceRegistry.read(file));
    boolean webInput=OperatorSettings.get("collector.web-input-enabled","COLLECTOR_WEB_INPUT_ENABLED","false").equals("true");
    if(webInput&&System.getenv("COLLECTOR_SOURCE_CONFIG")==null
        &&OperatorSettings.get("collector.sources-file","COLLECTOR_SOURCES_FILE","").isBlank())
      throw new CollectorFailure(503,"SOURCE_CONFIG_REQUIRED");
    var hikari=new HikariConfig();hikari.setJdbcUrl(OperatorSettings.url());hikari.setUsername(OperatorSettings.user());hikari.setPassword(OperatorSettings.password());hikari.setMaximumPoolSize(4);
    try(var db=new HikariDataSource(hikari)) {
      var store=new BatchStore(db);var objects=BatchObjectStore.fromEnvironment();
      var worker=new BatchQueueWorker(store,sources::get,new PinnedHttp(),objects);
      var runtime=new BatchSourceRuntime(store,UUID.randomUUID());var mailbox=new BatchMailbox(store);
      Runnable refresh=()->{
        var loaded=SourceRegistry.read(file);runtime.publish(loaded);sources.set(loaded);
        if(webInput)mailbox.pull(loaded);
      };
      refresh.run();
      DiscordGateway gateway=null;
      if(discord) {
        var properties=new HashMap<String,Object>();properties.put("collector.sources-file",file);
        for(String field:List.of("guilds","channels","users","roles","register-commands")) {
          properties.put("collector.discord-"+field,OperatorSettings.get("collector.discord-"+field,"COLLECTOR_DISCORD_"+field.replace('-','_').toUpperCase(Locale.ROOT),field.equals("register-commands")?"false":""));
        }
        var env=new StandardEnvironment();env.getPropertySources().addFirst(new MapPropertySource("batch-discord",properties));
        gateway=new DiscordGateway(OperatorSettings.secrets(),null,env,store);
      }
      var heartbeat=Executors.newSingleThreadScheduledExecutor(r->{var thread=new Thread(r,"batch-runtime-heartbeat");thread.setDaemon(true);return thread;});
      if(!flags.contains("--once"))heartbeat.scheduleWithFixedDelay(()->{
        try{refresh.run();}catch(CollectorFailure failure){System.err.println(Json.tree(Map.of("event","BATCH_INPUT_UNAVAILABLE","code",failure.getMessage())));}
        catch(RuntimeException failure){System.err.println("{\"event\":\"BATCH_INPUT_UNAVAILABLE\",\"code\":\"SOURCE_CONFIG_REQUIRED\"}");}
      },30,30,TimeUnit.SECONDS);
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
      finally {heartbeat.shutdownNow();heartbeat.awaitTermination(5,TimeUnit.SECONDS);if(gateway!=null)gateway.close();try{Runtime.getRuntime().removeShutdownHook(shutdown);}catch(IllegalStateException ignored){}}
    }
  }
}
