package com.blariyo.collector.discordreview;
import com.blariyo.collector.shared.Json;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** REST polling only. All durable state and publication commands belong to the API. */
public final class DiscordReviewWorker {
  private final ReviewConfig config;
  private final ReviewHttp.Transport transport;
  private final String workerId="review-"+UUID.randomUUID();
  private String botId;
  private String requestScope="";
  private final Set<String> reviewers=new HashSet<>();
  private final Map<String,Integer> counts=new TreeMap<>();
  public DiscordReviewWorker(ReviewConfig config,ReviewHttp.Transport transport){this.config=config;this.transport=transport;}
  private JsonNode api(String method,String path,Object body,String scope){
    var reply=transport.call("api",method,path,scope,body==null?null:Json.bytes(body),"application/json");
    JsonNode value;
    try{value=reply.json();}catch(Exception e){throw new ReviewFailure("REVIEW_API_RESPONSE_INVALID");}
    if(reply.status()!=200||!value.path("success").asBoolean()){
      String code=value.path("error").path("code").asText();
      throw new ReviewFailure(code.matches("[A-Z][A-Z0-9_]{0,79}")?code:"REVIEW_API_FAILED",reply.status()==400||reply.status()==403||reply.status()==410,0);
    }
    return value.path("data");
  }
  private JsonNode discord(String method,String path,Object body,int missing){
    var reply=transport.call("discord",method,path,requestScope,body==null?null:Json.bytes(body),"application/json");
    JsonNode value;
    try{value=reply.json();}catch(Exception e){throw new ReviewFailure("DISCORD_RESPONSE_INVALID");}
    if(reply.status()==404&&value.path("code").asInt()==missing)return null;
    if(reply.status()<200||reply.status()>=300)throw new ReviewFailure(reply.status()==404?"DISCORD_MESSAGE_MISSING":"DISCORD_REQUEST_FAILED",reply.status()>=400&&reply.status()<500,0);
    return value;
  }
  private static String id(JsonNode value,String key){return ReviewConfig.id(value,key);}
  private static String text(JsonNode value,String key){return ReviewConfig.text(value,key);}
  private static String optional(JsonNode value,String key){return value.path(key).isString()?value.path(key).asText():null;}
  private static String marker(String delivery,String part){return "br:"+delivery+":"+part;}
  private static String clip(String text,int max){if(text.length()<=max)return text;int end=Character.isHighSurrogate(text.charAt(max-1))?max-1:max;return text.substring(0,end)+"…";}
  private void counted(String result){counts.merge(result,1,Integer::sum);}
  private void scope(JsonNode delivery){
    if(!config.channelId().equals(text(delivery,"channelId"))||!config.guildId().equals(text(delivery,"guildId")))throw new ReviewFailure("DISCORD_SCOPE_INVALID",true,0);
  }
  public void preflight(){
    var runtime=api("GET","/runtime",null,"maintenance");
    if(!config.environment().equals(text(runtime,"environment"))||!config.guildId().equals(id(runtime,"guildId"))||!config.channelId().equals(id(runtime,"channelId")))throw new ReviewFailure("DISCORD_SCOPE_INVALID",true,0);
    for(var reviewer:runtime.path("reviewerIds"))reviewers.add(reviewer.asText());
    var me=discord("GET","/users/@me",null,-1);
    if(!me.path("bot").asBoolean())throw new ReviewFailure("DISCORD_BOT_REQUIRED",true,0);botId=id(me,"id");
    var channel=discord("GET","/channels/"+config.channelId(),null,-1);
    if(channel.path("type").asInt()!=0||!config.guildId().equals(id(channel,"guild_id")))throw new ReviewFailure("DISCORD_CHANNEL_SCOPE_INVALID",true,0);
  }
  private JsonNode thread(String id,boolean reopen){
    var value=discord("GET","/channels/"+id,null,10003);
    if(value==null)return null;
    if(!id.equals(id(value,"id"))||!config.channelId().equals(id(value,"parent_id"))||!config.guildId().equals(id(value,"guild_id"))||value.path("type").asInt()!=11)throw new ReviewFailure("DISCORD_THREAD_SCOPE_INVALID",true,0);
    if(reopen&&value.path("thread_metadata").path("archived").asBoolean())
      value=discord("PATCH","/channels/"+id,Map.of("archived",false),-1);
    return value;
  }
  private void ack(JsonNode d,String event,Object... pairs){
    var body=new LinkedHashMap<String,Object>();body.put("leaseToken",text(d,"leaseToken"));body.put("generation",d.path("generation").asLong());body.put("event",event);
    for(int i=0;i<pairs.length;i+=2)body.put((String)pairs[i],pairs[i+1]);
    api("POST","/deliveries/"+text(d,"id")+"/ack",body,"export");
  }
  private static Map<String,Object> payload(String content,String nonce){
    if(content.length()>2000)throw new ReviewFailure("DISCORD_CONTENT_TOO_LARGE",true,0);
    return Map.of("content",content,"nonce",nonce,"enforce_nonce",true,"allowed_mentions",Map.of("parse",List.of()),"flags",4);
  }
  private String postMessage(String channel,String content,String nonce){
    return id(discord("POST","/channels/"+channel+"/messages",payload(content,nonce),-1),"id");
  }
  private String recover(String channel,String marker,String nonce){
    String before=null,found=null;
    // Never blindly resend an uncertain POST after Discord's short nonce deduplication window.
    for(int page=0;page<100;page++){
      var values=discord("GET","/channels/"+channel+"/messages?limit=100"+(before==null?"":"&before="+before),null,10003);
      if(values==null)return null;
      if(!values.isArray())throw new ReviewFailure("DISCORD_RESPONSE_INVALID");
      for(var message:values){
        if(botId.equals(message.path("author").path("id").asText()) &&
            (message.path("content").asText().endsWith(marker)||nonce.equals(message.path("nonce").asText()))){
          String candidate=id(message,"id");
          if(found!=null&&!found.equals(candidate))throw new ReviewFailure("DISCORD_DUPLICATE_UNCERTAIN",true,0);
          found=candidate;
        }
      }
      if(values.size()<100)return found;
      String next=id(values.get(values.size()-1),"id");
      if(next.equals(before))throw new ReviewFailure("DISCORD_PAGINATION_INVALID");before=next;
    }
    throw new ReviewFailure("DISCORD_RECOVERY_LIMIT",true,0);
  }
  private void seed(String channel,String message){
    for(String emoji:List.of("👍","❌"))discord("PUT","/channels/"+channel+"/messages/"+message+"/reactions/"+URLEncoder.encode(emoji,StandardCharsets.UTF_8)+"/@me",null,-1);
  }
  private String head(JsonNode d,boolean ready){
    String url=optional(d,"sourceUrl");
    if(url==null)url="출처 확인 필요";else if(url.length()>600)url=URI.create(url).getScheme()+"://"+URI.create(url).getHost()+"/…";
    String title=optional(d,"title");if(title==null||title.isBlank())title="제목 없음";
    return "검수 #"+d.path("number").asLong()+"\n"+clip(title.replace('\n',' ').replace('\r',' '),1000)+"\n출처: <"+url+">\n"+
      (ready?"👍 승인·발행 / ❌ 글 전체 반려 · 둘 다 누르면 보류":"본문 준비 중 · 준비 완료 후 검수해 주세요")+"\n-# "+marker(text(d,"id"),"head");
  }
  private String image(JsonNode d,JsonNode part,String channel,String content,Runnable beforeSend){
    int position=part.path("imagePosition").asInt();
    String path="/deliveries/"+text(d,"id")+"/media/"+position+"?leaseToken="+text(d,"leaseToken")+"&generation="+d.path("generation").asLong();
    var media=transport.call("api","GET",path,"export",null,"application/json");
    if(media.status()!=200)throw new ReviewFailure("DISCORD_IMAGE_UNAVAILABLE",media.status()==410,0);
    if(media.bytes().length>10*1024*1024)throw new ReviewFailure("DISCORD_IMAGE_TOO_LARGE",true,0);
    String mime=media.contentType().split(";")[0];
    String ext=switch(mime){case "image/png"->"png";case "image/jpeg"->"jpg";case "image/gif"->"gif";case "image/webp"->"webp";default->throw new ReviewFailure("DISCORD_IMAGE_INVALID",true,0);};
    String boundary="Blariyo"+UUID.randomUUID().toString().replace("-","");
    try{
      var output=new ByteArrayOutputStream();
      output.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"payload_json\"\r\nContent-Type: application/json\r\n\r\n").getBytes(StandardCharsets.UTF_8));
      output.write(Json.bytes(payload(content,text(part,"nonce"))));
      output.write(("\r\n--"+boundary+"\r\nContent-Disposition: form-data; name=\"files[0]\"; filename=\"image."+ext+"\"\r\nContent-Type: "+mime+"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
      output.write(media.bytes());output.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
      beforeSend.run();
      var reply=transport.call("discord","POST","/channels/"+channel+"/messages","",output.toByteArray(),"multipart/form-data; boundary="+boundary);
      if(reply.status()!=200)throw new ReviewFailure("DISCORD_IMAGE_SEND_FAILED",reply.status()==413,0);
      return id(reply.json(),"id");
    }catch(java.io.IOException e){throw new ReviewFailure("DISCORD_IMAGE_SEND_FAILED");}
  }
  public boolean exportOne(){
    var d=api("POST","/export/claim",Map.of("workerId",workerId),"export").path("delivery");
    if(d.isNull())return false;scope(d);
    try{
      String deliveryId=text(d,"id"),headId=optional(d,"headMessageId");boolean cancelled="CANCELLED".equals(text(d,"state"));
      if(headId==null){
        if("PENDING".equals(text(d,"headSendState"))){
          if(cancelled)throw new ReviewFailure("BATCH_REVIEW_SUPERSEDED",true,0);
          ack(d,"HEAD_BEGIN");
          try{headId=postMessage(config.channelId(),head(d,false),text(d,"headNonce"));}
          catch(ReviewFailure e){if(e.code.equals("DISCORD_RATE_LIMITED"))ack(d,"HEAD_RETRY");throw e;}
        }else headId=recover(config.channelId(),marker(deliveryId,"head"),text(d,"headNonce"));
        if(headId==null)throw new ReviewFailure("DISCORD_EXPORT_UNCERTAIN",true,0);
        ack(d,"HEAD_SENT","messageId",headId);
        // Late ACK clears an obsolete lease and leaves cleanup only. Never start a thread.
        if(cancelled){counted("lateHeadRecovered");return true;}
      }
      String threadId=optional(d,"threadId");
      if(cancelled){
        // A known thread is deleted as a whole; unresolved part receipts may be recovered without new posts.
        if(threadId!=null&&thread(threadId,false)!=null)for(var part:d.path("parts")){
          if(!Set.of("SENDING","UNKNOWN").contains(text(part,"sendState")))continue;
          String recovered=recover(threadId,marker(deliveryId,Integer.toString(part.path("ordinal").asInt())),text(part,"nonce"));
          if(recovered==null)throw new ReviewFailure("DISCORD_EXPORT_UNCERTAIN",true,0);
          ack(d,"PART_SENT","ordinal",part.path("ordinal").asInt(),"messageId",recovered);
          return true;
        }
        if(threadId!=null&&thread(threadId,false)==null){ack(d,"CANCEL_RESOLVED");counted("cancelledExportResolved");return true;}
        throw new ReviewFailure("DISCORD_EXPORT_UNCERTAIN",false,0);
      }
      if(threadId==null||thread(threadId,true)==null){
        ack(d,"THREAD_BEGIN");
        var existing=thread(headId,true);
        if(existing==null)existing=discord("POST","/channels/"+config.channelId()+"/messages/"+headId+"/threads",Map.of("name","검수 #"+d.path("number").asLong(),"auto_archive_duration",4320),-1);
        threadId=id(existing,"id");ack(d,"THREAD_SENT","messageId",threadId);
      }
      for(var part:d.path("parts")){
        int ordinal=part.path("ordinal").asInt();String messageId=optional(part,"messageId");
        if(messageId==null){
          if("PENDING".equals(text(part,"sendState"))){
            var fragment=d.path("fragments").get(ordinal);
            if(fragment==null||!text(part,"unitId").equals(text(fragment,"unitId"))||part.path("fragmentIndex").asInt()!=fragment.path("fragmentIndex").asInt())throw new ReviewFailure("DISCORD_MANIFEST_INVALID",true,0);
            String content=fragment.path("text").asText()+"\n-# "+marker(deliveryId,Integer.toString(ordinal));
            try{
              if(part.path("imagePosition").isNull()){ack(d,"PART_BEGIN","ordinal",ordinal);messageId=postMessage(threadId,content,text(part,"nonce"));}
              else messageId=image(d,part,threadId,content,()->ack(d,"PART_BEGIN","ordinal",ordinal));
            }catch(ReviewFailure e){if(e.code.equals("DISCORD_RATE_LIMITED"))ack(d,"PART_RETRY","ordinal",ordinal);throw e;}
          }else messageId=recover(threadId,marker(deliveryId,Integer.toString(ordinal)),text(part,"nonce"));
          if(messageId==null)throw new ReviewFailure("DISCORD_EXPORT_UNCERTAIN",true,0);
          ack(d,"PART_SENT","ordinal",ordinal,"messageId",messageId);
        }
        if(!part.path("seeded").asBoolean()){seed(threadId,messageId);ack(d,"PART_SEEDED","ordinal",ordinal);}
      }
      // Clear all early head votes; body exclusions already made during rendering are preserved.
      discord("DELETE","/channels/"+config.channelId()+"/messages/"+headId+"/reactions",null,-1);
      seed(config.channelId(),headId);ack(d,"HEAD_SEEDED");
      discord("PATCH","/channels/"+config.channelId()+"/messages/"+headId,Map.of("content",head(d,true),"allowed_mentions",Map.of("parse",List.of()),"flags",4),-1);
      ack(d,"READY");counted("ready");return true;
    }catch(ReviewFailure e){
      try{ack(d,"ERROR","code",e.code,"blocked",e.blocked,"retryAfterMs",Math.min(86400000,e.retryAfterMs));}catch(ReviewFailure ignored){}
      counted(e.code);if(e.retryAfterMs>0)throw e;return true;
    }
  }
  private Map<String,JsonNode> messages(String channel,Set<String> wanted){
    var found=new HashMap<String,JsonNode>();String before=null;
    for(int page=0;page<100;page++){
      var values=discord("GET","/channels/"+channel+"/messages?limit=100"+(before==null?"":"&before="+before),null,-1);
      if(!values.isArray())throw new ReviewFailure("DISCORD_RESPONSE_INVALID");
      for(var message:values)if(wanted.contains(id(message,"id")))found.put(id(message,"id"),message);
      if(found.size()==wanted.size()||values.size()<100)return found;
      String next=id(values.get(values.size()-1),"id");if(next.equals(before))throw new ReviewFailure("DISCORD_PAGINATION_INVALID");before=next;
    }
    throw new ReviewFailure("DISCORD_READ_LIMIT");
  }
  private Map<String,Object> observe(String channel,JsonNode message,String expected){
    if(message==null||!botId.equals(message.path("author").path("id").asText())||!message.path("content").asText().endsWith(expected))throw new ReviewFailure("DISCORD_MESSAGE_BINDING_INVALID");
    String messageId=id(message,"id");var reactions=new ArrayList<Object>();
    for(var reaction:message.path("reactions")){
      var emoji=reaction.path("emoji");String name=text(emoji,"name");
      String encoded=URLEncoder.encode(emoji.path("id").isNull()?name:name+":"+id(emoji,"id"),StandardCharsets.UTF_8);
      var users=new TreeMap<String,Object>();
      int normal=reaction.path("count_details").path("normal").asInt(-1),burst=reaction.path("count_details").path("burst").asInt(-1);
      if(normal<0||burst<0)throw new ReviewFailure("DISCORD_REACTION_COUNTS_MISSING");
      if(normal==1&&burst==0&&reaction.path("me").asBoolean()){
        reactions.add(Map.of("emoji",name,"users",List.of(),"complete",true));continue;
      }
      for(int kind=0;kind<=1;kind++){
        if((kind==0?normal:burst)==0)continue;
        String after=null;boolean complete=false;
        for(int page=0;page<100;page++){
          var values=discord("GET","/channels/"+channel+"/messages/"+messageId+"/reactions/"+encoded+"?limit=100&type="+kind+(after==null?"":"&after="+after),null,-1);
          if(!values.isArray())throw new ReviewFailure("DISCORD_RESPONSE_INVALID");
          for(var user:values)if(reviewers.contains(id(user,"id"))&&!user.path("bot").asBoolean())users.put(id(user,"id"),Map.of("id",id(user,"id"),"bot",false));
          if(values.size()<100){complete=true;break;}
          String next=id(values.get(values.size()-1),"id");if(next.equals(after))throw new ReviewFailure("DISCORD_PAGINATION_INVALID");after=next;
        }
        if(!complete)throw new ReviewFailure("DISCORD_REACTION_READ_LIMIT");
      }
      // Custom emoji named like a thumbs-up is still a different reaction.
      reactions.add(Map.of("emoji",emoji.path("id").isNull()?name:name+":"+id(emoji,"id"),"users",new ArrayList<>(users.values()),"complete",true));
    }
    return Map.of("messageId",messageId,"complete",true,"reactions",reactions);
  }
  public void scan(){
    var scan=api("POST","/scan/claim",Map.of("workerId",workerId),"scan").path("scan");if(scan.isNull())return;
    var scanBody=Map.of("scanId",text(scan,"id"),"leaseToken",text(scan,"leaseToken"));
    for(int item=0;item<1000;item++){
      var d=api("POST","/scan/next",scanBody,"scan").path("delivery");if(d.isNull())return;scope(d);
      var result=new ArrayList<Map<String,Object>>();String delivery=text(d,"id");
      long started=System.nanoTime();
      try{
        String headId=id(d,"headMessageId"),threadId=id(d,"threadId");if(thread(threadId,true)==null)throw new ReviewFailure("DISCORD_THREAD_MISSING");
        result.add(observe(config.channelId(),discord("GET","/channels/"+config.channelId()+"/messages/"+headId,null,-1),marker(delivery,"head")));
        var wanted=new HashSet<String>();for(var part:d.path("parts"))wanted.add(id(part,"messageId"));
        var found=messages(threadId,wanted);
        for(var part:d.path("parts")){
          if(System.nanoTime()-started>100_000_000_000L)throw new ReviewFailure("DISCORD_OBSERVATION_TIMEOUT");
          result.add(observe(threadId,found.get(id(part,"messageId")),marker(delivery,Integer.toString(part.path("ordinal").asInt()))));
        }
      }catch(ReviewFailure e){result.clear();counted(e.code);if(e.retryAfterMs>0)throw e;}
      // Missing/failed reads submit no complete observation; API cannot mistake them for absent votes.
      var chunk=new ArrayList<Map<String,Object>>();int index=0,bytes=0;
      for(var message:result){int size=Json.bytes(message).length;if(size>128000)throw new ReviewFailure("DISCORD_OBSERVATION_TOO_LARGE");
        if(chunk.size()>=100||bytes+size>128000){submitChunk(scanBody,delivery,index++,chunk);chunk.clear();bytes=0;}
        chunk.add(message);bytes+=size;
      }
      if(!chunk.isEmpty())submitChunk(scanBody,delivery,index,chunk);
      var finish=new LinkedHashMap<String,Object>(scanBody);finish.put("deliveryId",delivery);
      counted(api("POST","/scan/finish",finish,"scan").path("result").asText());
    }
    throw new ReviewFailure("DISCORD_SCAN_RUN_LIMIT");
  }
  private void submitChunk(Map<String,String> scan,String delivery,int index,List<Map<String,Object>> messages){
    var body=new LinkedHashMap<String,Object>(scan);body.put("deliveryId",delivery);body.put("index",index);body.put("messages",messages);
    api("POST","/scan/chunk",body,"scan");
  }
  public void cleanup(String delivery){
    var claim=api("POST","/deliveries/"+delivery+"/cleanup/claim",Map.of("workerId",workerId),"maintenance").path("claim");if(claim.isNull())return;
    if(!config.channelId().equals(id(claim,"channelId")))throw new ReviewFailure("DISCORD_SCOPE_INVALID",true,0);
    boolean head=claim.path("headDeleted").asBoolean(),thread=claim.path("threadDeleted").asBoolean();ReviewFailure failure=null;
    requestScope="cleanup";
    try{
      String headId=optional(claim,"headMessageId"),threadId=optional(claim,"threadId");
      if(!head&&headId!=null){discord("DELETE","/channels/"+config.channelId()+"/messages/"+headId,null,10008);head=true;}
      if(!thread&&threadId!=null){if(thread(threadId,false)!=null)discord("DELETE","/channels/"+threadId,null,10003);thread=true;}
    }catch(ReviewFailure e){failure=e;}finally{requestScope="";}
    var result=new LinkedHashMap<String,Object>();result.put("headDeleted",head);result.put("threadDeleted",thread);result.put("error",failure==null?null:failure.code);
    result.put("blocked",failure!=null&&failure.blocked);result.put("retryAfterMs",failure==null?0:Math.min(86400000,failure.retryAfterMs));
    api("POST","/deliveries/"+delivery+"/cleanup/ack",Map.of("claim",claim,"result",result),"maintenance");counted(failure==null?"cleanup":failure.code);
    if(failure!=null)notice(delivery);
    if(failure!=null&&failure.retryAfterMs>0)throw failure;
  }
  public void notice(String delivery){
    var claim=api("POST","/deliveries/"+delivery+"/notice/claim",Map.of("workerId",workerId),"maintenance").path("claim");if(claim.isNull())return;
    var ack=new LinkedHashMap<String,Object>();ack.put("leaseToken",text(claim,"leaseToken"));ack.put("attemptId",text(claim,"attemptId"));
    try{
      if(!config.channelId().equals(id(claim,"channelId")))throw new ReviewFailure("DISCORD_SCOPE_INVALID",true,0);
      String thread=id(claim,"threadId");
      if(thread(thread,true)==null){ack.put("unavailable",true);ack.put("error","DISCORD_THREAD_MISSING");}
      else{
        String marker=marker(delivery,"notice"),content=text(claim,"text")+"\n-# "+marker,messageId=optional(claim,"messageId");
        if(messageId!=null&&discord("GET","/channels/"+thread+"/messages/"+messageId,null,10008)==null)messageId=null;
        if(messageId==null)messageId=recover(thread,marker,text(claim,"nonce"));
        if(messageId==null)messageId=postMessage(thread,content,text(claim,"nonce"));
        else discord("PATCH","/channels/"+thread+"/messages/"+messageId,Map.of("content",content,"allowed_mentions",Map.of("parse",List.of())), -1);
        ack.put("messageId",messageId);
      }
    }catch(ReviewFailure e){ack.put("error",e.code);ack.put("blocked",e.blocked);ack.put("retryAfterMs",Math.min(86400000,e.retryAfterMs));}
    api("POST","/deliveries/"+delivery+"/notice/ack",ack,"maintenance");counted("noticeAttempt");
  }
  public void maintain(int maxExports){
    var jobs=api("GET","/jobs",null,"maintenance");
    for(var command:jobs.path("commands")){
      String path="/commands/"+command.asText()+"/advance";
      var result=api("POST",path,Map.of("workerId",workerId),"maintenance");
      if("DRAFTED".equals(result.path("stage").asText()))result=api("POST",path,Map.of("workerId",workerId),"maintenance");
      counted(result.path("stage").asText());
    }
    // Send pending outcome notices before another deletion could remove the surviving thread.
    for(var notice:jobs.path("notices"))notice(notice.asText());
    for(var cleanup:jobs.path("cleanup"))cleanup(cleanup.asText());
    for(int i=0;i<maxExports&&exportOne();i++){}
  }
  public Map<String,Integer> counts(){return Map.copyOf(counts);}
}
