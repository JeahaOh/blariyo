package com.blariyo.collector.discordreview;
import com.blariyo.collector.shared.Json;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import tools.jackson.databind.JsonNode;
/** Fixed service origins, bounded reads, no redirects and no request/response logging. */
public final class ReviewHttp implements AutoCloseable {
  public record Reply(int status, byte[] bytes, String contentType) { public JsonNode json(){return bytes.length==0?Json.tree(Map.of()):Json.parse(bytes);} }
  @FunctionalInterface public interface Transport { Reply call(String service,String method,String path,String scope,byte[] body,String contentType); }
  private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
  private final ScheduledExecutorService timer=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"discord-http-deadline");t.setDaemon(true);return t;});
  private final ReviewConfig config;
  private long discordAfter;
  public ReviewHttp(ReviewConfig config){this.config=config;}
  public Reply call(String service,String method,String path,String scope,byte[] body,String contentType){
    if(!path.startsWith("/")||path.startsWith("//")||path.contains("..")||path.contains("#"))throw new ReviewFailure("DISCORD_HTTP_SCOPE_INVALID",true,0);
    boolean discord=service.equals("discord");
    if(!discord&&!service.equals("api"))throw new ReviewFailure("DISCORD_HTTP_SCOPE_INVALID",true,0);
    String origin=discord?"https://discord.com/api/v10":config.apiOrigin()+"/internal/discord-review/v1";
    int timeout=scope.equals("cleanup")?2:30;
    if(discord){long wait=(discordAfter-System.nanoTime())/1_000_000;if(wait>5000||scope.equals("cleanup")&&wait>1000)throw new ReviewFailure("DISCORD_RATE_LIMITED",false,wait);if(wait>0)pause(wait);}
    try{
      var request=HttpRequest.newBuilder(URI.create(origin+path)).timeout(Duration.ofSeconds(timeout));
      if(discord)request.header("Authorization","Bot "+config.botToken());
      else request.header("X-Blariyo-Review-Token",config.workerToken()).header("X-Blariyo-Review-Scope",scope);
      request.header("User-Agent","BlariyoReview/1.0");
      if(body!=null)request.header("Content-Type",contentType);
      var response=http.send(request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofByteArray(body)).build(),HttpResponse.BodyHandlers.ofInputStream());
      byte[] bytes;
      try(var stream=response.body()){
        var deadline=timer.schedule(()->{try{stream.close();}catch(IOException ignored){}},timeout,TimeUnit.SECONDS);
        try{bytes=stream.readNBytes(12*1024*1024+1);}finally{deadline.cancel(false);}
      }
      if(bytes.length>12*1024*1024)throw new ReviewFailure("DISCORD_RESPONSE_TOO_LARGE",true,0);
      if(discord){
        long wait=220;
        if(response.headers().firstValue("X-RateLimit-Remaining").orElse("1").equals("0"))
          wait=Math.max(wait,seconds(response.headers().firstValue("X-RateLimit-Reset-After").orElse("0")));
        discordAfter=System.nanoTime()+wait*1_000_000;
      }
      if(response.statusCode()==429){
        long wait=seconds(response.headers().firstValue("Retry-After").orElse("0"));
        try{wait=Math.max(wait,(long)Math.ceil(Json.parse(bytes).path("retry_after").asDouble(0)*1000));}catch(Exception ignored){}
        throw new ReviewFailure("DISCORD_RATE_LIMITED",false,Math.max(1000,wait));
      }
      if(response.statusCode()==401||response.statusCode()==403)throw new ReviewFailure(discord?"DISCORD_FORBIDDEN":"DISCORD_WORKER_FORBIDDEN",true,0);
      if(response.statusCode()>=300&&response.statusCode()<400)throw new ReviewFailure("DISCORD_REDIRECT_FORBIDDEN",true,0);
      return new Reply(response.statusCode(),bytes,response.headers().firstValue("Content-Type").orElse("application/octet-stream"));
    }catch(ReviewFailure e){throw e;}catch(Exception e){if(e instanceof InterruptedException)Thread.currentThread().interrupt();throw new ReviewFailure("DISCORD_HTTP_UNAVAILABLE");}
  }
  private static long seconds(String input){try{double n=Double.parseDouble(input);return Double.isFinite(n)&&n>0?Math.min(86400000,(long)Math.ceil(n*1000)):0;}catch(Exception e){return 0;}}
  static void pause(long ms){try{Thread.sleep(Math.min(ms,86400000));}catch(InterruptedException e){Thread.currentThread().interrupt();throw new ReviewFailure("DISCORD_INTERRUPTED");}}
  @Override public void close(){timer.shutdownNow();http.close();}
}
