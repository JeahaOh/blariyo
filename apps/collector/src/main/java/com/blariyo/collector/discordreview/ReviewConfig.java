package com.blariyo.collector.discordreview;
import com.blariyo.collector.shared.Json;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Set;
import tools.jackson.databind.JsonNode;
public record ReviewConfig(String environment, String apiOrigin, String guildId, String channelId, String botToken, String workerToken) {
  public static byte[] privateBytes(String path, int max) {
    try {
      Path file=Path.of(path);
      if(!file.isAbsolute() || !Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS))throw new Exception();
      var permissions=Files.getPosixFilePermissions(file,LinkOption.NOFOLLOW_LINKS);
      if(!Set.of(Set.of(PosixFilePermission.OWNER_READ),Set.of(PosixFilePermission.OWNER_READ,PosixFilePermission.OWNER_WRITE)).contains(permissions))throw new Exception();
      try(var channel=Files.newByteChannel(file,Set.of(StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS))) {
        var bytes=ByteBuffer.allocate(max+1);
        while(bytes.hasRemaining()&&channel.read(bytes)>=0){}
        if(bytes.position()>max)throw new Exception();
        return java.util.Arrays.copyOf(bytes.array(),bytes.position());
      }
    }catch(Exception e){throw new ReviewFailure("DISCORD_PRIVATE_FILE_INVALID",true,0);}
  }
  public static String text(JsonNode value,String key){
    JsonNode node=value.path(key);
    if(!node.isString()||node.asText().isBlank())throw new ReviewFailure("DISCORD_REVIEW_CONFIG_INVALID",true,0);
    return node.asText();
  }
  public static String id(JsonNode value,String key){String id=text(value,key);if(!id.matches("[0-9]{17,20}"))throw new ReviewFailure("DISCORD_ID_INVALID",true,0);return id;}
  public static ReviewConfig load(String path){
    JsonNode config=Json.parse(privateBytes(path,65536));
    String environment=text(config,"environment"),origin=text(config,"apiOrigin"),guild=id(config,"guildId"),channel=id(config,"channelId");
    if(!Set.of("production","local_test").contains(environment)||!origin.matches("http://(?:api|127\\.0\\.0\\.1|localhost):[1-9][0-9]{1,4}"))throw new ReviewFailure("DISCORD_REVIEW_CONFIG_INVALID",true,0);
    String bot=new String(privateBytes(text(config,"botTokenFile"),512),StandardCharsets.UTF_8).strip();
    String worker=new String(privateBytes(text(config,"workerTokenFile"),512),StandardCharsets.UTF_8).strip();
    if(!bot.matches("[A-Za-z0-9_.-]{40,200}")||!worker.matches("[A-Za-z0-9_-]{32,200}"))throw new ReviewFailure("DISCORD_TOKEN_INVALID",true,0);
    return new ReviewConfig(environment,origin,guild,channel,bot,worker);
  }
  @Override public String toString(){return "ReviewConfig[REDACTED]";}
}
