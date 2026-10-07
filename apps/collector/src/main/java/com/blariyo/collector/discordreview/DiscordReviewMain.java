package com.blariyo.collector.discordreview;
import com.blariyo.collector.shared.Json;
import java.util.Map;
public final class DiscordReviewMain {
  public static void main(String[] args){
    try{
      if(args.length!=1||!java.util.Set.of("maintain","scan","check").contains(args[0]))throw new ReviewFailure("DISCORD_REVIEW_OPTIONS_INVALID",true,0);
      String path=System.getenv("DISCORD_REVIEW_WORKER_CONFIG_FILE");if(path==null)throw new ReviewFailure("DISCORD_REVIEW_CONFIG_REQUIRED",true,0);
      ReviewConfig config=ReviewConfig.load(path);
      try(var http=new ReviewHttp(config)){
        var worker=new DiscordReviewWorker(config,http::call);worker.preflight();
        if(args[0].equals("maintain")){worker.scan();worker.maintain(20);}
        if(args[0].equals("scan")){worker.scan();worker.maintain(0);}
        System.out.println(new String(Json.bytes(Map.of("state","COMPLETED","environment",config.environment(),"mode",args[0],"counts",worker.counts())),java.nio.charset.StandardCharsets.UTF_8));
      }
    }catch(ReviewFailure e){System.err.println(new String(Json.bytes(Map.of("state","DEFERRED","code",e.code,"retryAfterMs",e.retryAfterMs)),java.nio.charset.StandardCharsets.UTF_8));System.exit(1);}
    catch(Exception e){System.err.println("DISCORD_REVIEW_FAILED");System.exit(1);}
  }
}
