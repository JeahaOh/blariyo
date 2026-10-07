package com.blariyo.collector.discordreview;
import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.Json;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
class DiscordReviewWorkerTest {
  static final String GUILD="111111111111111111",CHANNEL="222222222222222222",BOT="333333333333333333",HUMAN="444444444444444444",HEAD="555555555555555555",BODY="666666666666666666";
  static final String DELIVERY="abcdefab-1234-4123-8123-abcdefabcdef",LEASE="11111111-2222-4333-8444-555555555555";
  static ReviewHttp.Reply reply(Object body){return new ReviewHttp.Reply(200,Json.bytes(body),"application/json");}
  static ReviewHttp.Reply api(Object body){return reply(Map.of("success",true,"data",body));}
  static ReviewConfig config(){return new ReviewConfig("local_test","http://127.0.0.1:3100",GUILD,CHANNEL,"b".repeat(60),"w".repeat(64));}
  static Map<String,Object> delivery(boolean sent){
    var value=new LinkedHashMap<String,Object>();value.put("id",DELIVERY);value.put("itemId",DELIVERY);value.put("number",1);value.put("state","EXPORTING");value.put("generation",1);value.put("channelId",CHANNEL);value.put("guildId",GUILD);value.put("leaseToken",LEASE);
    value.put("headMessageId",sent?HEAD:null);value.put("threadId",sent?HEAD:null);value.put("headSendState",sent?"SENT":"PENDING");value.put("headNonce","headnonce");
    value.put("title","검수 제목 @everyone");value.put("sourceUrl","https://example.invalid/1");
    var part=new LinkedHashMap<String,Object>();part.put("ordinal",0);part.put("unitId","a".repeat(64));part.put("fragmentIndex",0);part.put("imagePosition",null);part.put("messageId",sent?BODY:null);part.put("sendState",sent?"SENT":"PENDING");part.put("seeded",false);part.put("nonce","partnonce");
    value.put("parts",List.of(part));
    var fragment=new LinkedHashMap<String,Object>();fragment.put("unitId","a".repeat(64));fragment.put("fragmentIndex",0);fragment.put("text","수집 문장입니다.");fragment.put("imagePosition",null);value.put("fragments",List.of(fragment));return value;
  }
  static Object thread(){return Map.of("id",HEAD,"parent_id",CHANNEL,"guild_id",GUILD,"type",11,"thread_metadata",Map.of("archived",false));}
  static ReviewHttp.Reply preflight(String service,String path){
    if(service.equals("api")&&path.equals("/runtime"))return api(Map.of("environment","local_test","guildId",GUILD,"channelId",CHANNEL,"reviewerIds",List.of(HUMAN),"serverTime","2026-10-07T00:00:00Z"));
    if(path.equals("/users/@me"))return reply(Map.of("id",BOT,"bot",true));
    if(path.equals("/channels/"+CHANNEL))return reply(Map.of("id",CHANNEL,"guild_id",GUILD,"type",0));return null;
  }
  @Test void completeExportSeedsEveryMessageAndOnlyThenMarksReady(){
    var events=new ArrayList<String>();var writes=new ArrayList<JsonNode>();var reactions=new AtomicInteger();var creates=new AtomicInteger();
    var worker=new DiscordReviewWorker(config(),(service,method,path,scope,bytes,mime)->{
      var initial=preflight(service,path);if(initial!=null)return initial;
      if(service.equals("api")){
        if(path.equals("/export/claim"))return api(Map.of("delivery",delivery(false)));
        JsonNode body=Json.parse(bytes);events.add(body.path("event").asText());return api(Map.of("accepted",true));
      }
      if(path.equals("/channels/"+HEAD)&&method.equals("GET"))return new ReviewHttp.Reply(404,Json.bytes(Map.of("code",10003)),"application/json");
      if(path.endsWith("/threads"))return reply(thread());
      if(method.equals("POST")&&path.endsWith("/messages")){writes.add(Json.parse(bytes));return reply(Map.of("id",creates.getAndIncrement()==0?HEAD:BODY));}
      if(method.equals("PUT")){reactions.incrementAndGet();return new ReviewHttp.Reply(204,new byte[0],"");}
      if(method.equals("DELETE")||method.equals("PATCH"))return reply(Map.of());
      fail(method+" "+path);return null;
    });
    worker.preflight();assertTrue(worker.exportOne());
    assertEquals(List.of("HEAD_BEGIN","HEAD_SENT","THREAD_BEGIN","THREAD_SENT","PART_BEGIN","PART_SENT","PART_SEEDED","HEAD_SEEDED","READY"),events);
    assertEquals(4,reactions.get());assertEquals(2,writes.size());
    for(var body:writes){assertTrue(body.path("enforce_nonce").asBoolean());assertEquals(0,body.path("allowed_mentions").path("parse").size());assertTrue(body.path("content").asText().length()<=2000);}
    assertTrue(writes.get(0).path("content").asText().contains("출처"));assertEquals(1,worker.counts().get("ready"));
  }
  @Test void lostHeadReceiptRecoversByOwnBotMarkerWithoutRepostingHead(){
    var d=delivery(true);d.put("headMessageId",null);d.put("headSendState","SENDING");var events=new ArrayList<String>();
    var worker=new DiscordReviewWorker(config(),(service,method,path,scope,bytes,mime)->{
      var initial=preflight(service,path);if(initial!=null)return initial;
      if(service.equals("api")){if(path.equals("/export/claim"))return api(Map.of("delivery",d));events.add(Json.parse(bytes).path("event").asText());return api(Map.of("accepted",true));}
      if(path.equals("/channels/"+CHANNEL+"/messages?limit=100"))return reply(List.of(Map.of("id",HEAD,"author",Map.of("id",BOT),"content","-# br:"+DELIVERY+":head")));
      if(path.equals("/channels/"+HEAD))return reply(thread());
      assertNotEquals("POST",method,"uncertain export must not create another message");return reply(Map.of());
    });worker.preflight();assertTrue(worker.exportOne());assertEquals("HEAD_SENT",events.getFirst());assertTrue(events.contains("READY"));
  }
  @Test void definitiveRateLimitReturnsPendingButUnknownNetworkFailureDoesNotResend(){
    for(String code:List.of("DISCORD_RATE_LIMITED","DISCORD_HTTP_UNAVAILABLE")){
      var events=new ArrayList<String>();var worker=new DiscordReviewWorker(config(),(service,method,path,scope,bytes,mime)->{
        var initial=preflight(service,path);if(initial!=null)return initial;
        if(service.equals("api")){if(path.equals("/export/claim"))return api(Map.of("delivery",delivery(false)));events.add(Json.parse(bytes).path("event").asText());return api(Map.of("accepted",true));}
        throw new ReviewFailure(code,false,code.equals("DISCORD_RATE_LIMITED")?3000:0);
      });worker.preflight();
      if(code.equals("DISCORD_RATE_LIMITED")){assertThrows(ReviewFailure.class,worker::exportOne);assertEquals(List.of("HEAD_BEGIN","HEAD_RETRY","ERROR"),events);}
      else{assertTrue(worker.exportOne());assertEquals(List.of("HEAD_BEGIN","ERROR"),events);}
    }
  }
  @Test void scansAllNormalAndBurstUserPagesAndIgnoresUnregisteredPeople(){
    var chunks=new ArrayList<JsonNode>();var next=new AtomicInteger();var reactionPages=new AtomicInteger();
    var worker=new DiscordReviewWorker(config(),(service,method,path,scope,bytes,mime)->{
      var initial=preflight(service,path);if(initial!=null)return initial;
      if(service.equals("api")){
        if(path.equals("/scan/claim"))return api(Map.of("scan",Map.of("id",DELIVERY,"leaseToken",LEASE)));
        if(path.equals("/scan/next")){var data=new HashMap<String,Object>();data.put("delivery",next.getAndIncrement()==0?delivery(true):null);return api(data);}
        if(path.equals("/scan/chunk")){chunks.add(Json.parse(bytes));return api(Map.of("accepted",true));}
        if(path.equals("/scan/finish"))return api(Map.of("result","APPROVED"));
      }
      if(path.equals("/channels/"+HEAD))return reply(thread());
      if(path.equals("/channels/"+CHANNEL+"/messages/"+HEAD))return reply(message(HEAD,"head","👍",101,1));
      if(path.equals("/channels/"+HEAD+"/messages?limit=100"))return reply(List.of(message(BODY,"0","❌",1,1)));
      if(path.contains("/reactions/")){
        reactionPages.incrementAndGet();
        if(path.contains("type=0")&&!path.contains("after=")&&path.contains("/"+HEAD+"/reactions/")){
          var users=new ArrayList<Object>();for(int i=0;i<100;i++)users.add(Map.of("id",Long.toString(777777777777777700L+i),"bot",false));return reply(users);
        }
        return reply(List.of(Map.of("id",HUMAN,"bot",false),Map.of("id",BOT,"bot",true)));
      }
      fail(method+" "+path);return null;
    });worker.preflight();worker.scan();assertEquals(5,reactionPages.get());assertEquals(1,chunks.size());
    var messages=chunks.getFirst().path("messages");assertEquals(2,messages.size());
    for(var message:messages){var users=message.path("reactions").get(0).path("users");assertEquals(1,users.size());assertEquals(HUMAN,users.get(0).path("id").asText());}
    assertEquals(1,worker.counts().get("APPROVED"));
  }
  static Object message(String id,String part,String emoji,int normal,int burst){
    var value=new LinkedHashMap<String,Object>();value.put("id",id);value.put("author",Map.of("id",BOT));value.put("content","-# br:"+DELIVERY+":"+part);
    var e=new HashMap<String,Object>();e.put("name",emoji);e.put("id",null);
    value.put("reactions",List.of(Map.of("emoji",e,"count_details",Map.of("normal",normal,"burst",burst),"me",true)));return value;
  }
  @Test void incompleteReadNeverBecomesAnEmptyVoteAndCleanupFailureKeepsThread(){
    var next=new AtomicInteger();var finishes=new AtomicInteger();
    var worker=new DiscordReviewWorker(config(),(service,method,path,scope,bytes,mime)->{
      var initial=preflight(service,path);if(initial!=null)return initial;
      if(service.equals("api")){
        if(path.equals("/scan/claim"))return api(Map.of("scan",Map.of("id",DELIVERY,"leaseToken",LEASE)));
        if(path.equals("/scan/next")){var value=new HashMap<String,Object>();value.put("delivery",next.getAndIncrement()==0?delivery(true):null);return api(value);}
        if(path.equals("/scan/chunk"))fail("incomplete observations must not become complete empty messages");
        if(path.equals("/scan/finish")){finishes.incrementAndGet();return api(Map.of("result","READ_INCOMPLETE"));}
      }
      return new ReviewHttp.Reply(404,Json.bytes(Map.of("code",10003)),"application/json");
    });worker.preflight();worker.scan();assertEquals(1,finishes.get());
    var deletes=new ArrayList<String>();var results=new ArrayList<JsonNode>();
    var cleanup=new DiscordReviewWorker(config(),(service,method,path,scope,bytes,mime)->{
      if(service.equals("api")){
        if(path.endsWith("/notice/claim")){var data=new HashMap<String,Object>();data.put("claim",null);return api(data);}
        if(path.endsWith("/claim"))return api(Map.of("claim",Map.of("deliveryId",DELIVERY,"channelId",CHANNEL,"headMessageId",HEAD,"threadId",HEAD,"headDeleted",false,"threadDeleted",false,"leaseToken",LEASE,"attemptId",DELIVERY)));
        results.add(Json.parse(bytes).path("result"));return api(Map.of("accepted",true));
      }
      deletes.add(path);assertEquals("cleanup",scope);throw new ReviewFailure("DISCORD_RATE_LIMITED",false,4000);
    });assertThrows(ReviewFailure.class,()->cleanup.cleanup(DELIVERY));assertEquals(List.of("/channels/"+CHANNEL+"/messages/"+HEAD),deletes);
    assertEquals(4000,results.getFirst().path("retryAfterMs").asLong());assertFalse(results.getFirst().path("threadDeleted").asBoolean());
  }
}
