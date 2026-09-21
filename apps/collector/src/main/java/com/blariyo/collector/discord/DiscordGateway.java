package com.blariyo.collector.discord;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.run.CollectorRunService;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.run.CandidateIntake;
import com.blariyo.collector.run.BatchStore;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.spool.EncryptedSpool;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import net.dv8tion.jda.api.*;
import net.dv8tion.jda.api.components.actionrow.ActionRow;
import net.dv8tion.jda.api.components.buttons.Button;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.requests.GatewayIntent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
@ConditionalOnProperty(name = "collector.discord-enabled", havingValue = "true")
public final class DiscordGateway extends ListenerAdapter {
  private final Secrets secrets;
  private final CoreClient core;
  private final RunRepository runs;
  private final CollectorRunService submissions;
  private final EncryptedSpool spool;
  private final Environment env;
  private final JDA jda;
  private final CandidateIntake intake;
  private final BatchStore batchStore;

  public DiscordGateway(
      Secrets secrets,
      CoreClient core,
      RunRepository runs,
      EncryptedSpool spool,
      Environment env,
      CollectorRunService submissions,
      CandidateIntake intake,
      BatchStore batchStore) {
    this.intake = intake;
    this.batchStore = batchStore;
    this.secrets = secrets;
    this.core = core;
    this.runs = runs;
    this.submissions = submissions;
    this.spool = spool;
    this.env = env;
    if (allowed("guilds").isEmpty()
        || allowed("channels").isEmpty()
        || allowed("users").isEmpty() && allowed("roles").isEmpty())
      throw new CollectorFailure(503, "DISCORD_ALLOWLIST_REQUIRED");
    jda =
        JDABuilder.createLight(
                secrets.require("discord-token"), EnumSet.noneOf(GatewayIntent.class))
            .addEventListeners(this)
            .build();
  }

  @Override
  public void onReady(net.dv8tion.jda.api.events.session.ReadyEvent event) {
    if (!env.getProperty("collector.discord-register-commands", Boolean.class, false)) return;
    for (String id : allowed("guilds")) {
      var guild = event.getJDA().getGuildById(id);
      if (guild != null) guild.upsertCommand(DiscordCommands.collect()).queue(
          ignored -> {}, failure -> org.slf4j.LoggerFactory.getLogger(DiscordGateway.class)
              .warn("DISCORD_COMMAND_REGISTRATION_FAILED"));
    }
  }

  private Set<String> allowed(String field) {
    String value = env.getProperty("collector.discord-" + field, "");
    return value.isBlank() ? Set.of() : Set.copyOf(Arrays.asList(value.split(",")));
  }

  private boolean authorized(String guild, String channel, String user, List<String> roles) {
    return new DiscordPolicy(
            allowed("guilds"), allowed("channels"), allowed("users"), allowed("roles"))
        .authorized(guild, channel, user, roles);
  }

  @Override
  public void onSlashCommandInteraction(SlashCommandInteractionEvent event) {
    if (!event.getName().equals("collect")) return;
    if (!authorized(
        event.getGuild() == null ? null : event.getGuild().getId(),
        event.getChannel().getId(),
        event.getUser().getId(),
        event.getMember() == null
            ? List.of()
            : event.getMember().getRoles().stream().map(r -> r.getId()).toList())) {
      event.reply("허용된 수집 명령 대상이 아닙니다.").setEphemeral(true).setAllowedMentions(List.of()).queue();
      return;
    }
    event
        .deferReply(true)
        .queue(
            hook -> {
              try {
                if ("status".equals(event.getSubcommandName())) {
                  var status = core.get("/status");
                  hook.editOriginal(
                          "수집 상태: "
                              + status.path("candidateCounts").toString()
                              + " / 로컬: "
                              + runs.counts())
                      .queue();
                  return;
                }
                if (!"url".equals(event.getSubcommandName()) || event.getOption("url") == null) {
                  hook.editOriginal("URL 수집 또는 상태 조회 명령을 사용하세요.").queue();
                  return;
                }
                String url = event.getOption("url").getAsString();
                var resolved = intake.resolve(url);
                url = resolved.canonical(url);
                URI uri = URI.create(url);
                UUID confirmation = UUID.randomUUID(),
                    ref =
                        spool.put(
                            Json.bytes(
                                Map.of(
                                    "url",
                                    url,
                                    "channel",
                                    event.getChannel().getId(),
                                    "user",
                                    event.getUser().getId())));
                runs.jdbc()
                    .update(
                        "INSERT INTO"
                            + " collector.confirmation(id,actor_hmac,channel_hmac,spool_ref,trigger_key_hash)"
                            + " VALUES(?,?,?,?,?)",
                        confirmation,
                        secrets.hmac(event.getUser().getId()),
                        secrets.hmac(event.getChannel().getId()),
                        ref,
                        secrets.hmac(event.getId()));
                hook.editOriginal(
                        "출처: "
                            + resolved.key() + " (" + uri.getHost() + ")"
                            + "\n대상: "
                            + url
                            + "\nrobots·상세·이미지 요청이 발생하며 검수 후에만 발행됩니다.")
                    .setComponents(
                        ActionRow.of(Button.primary("collect-confirm:" + confirmation, "수집 확인")))
                    .queue();
              } catch (Exception e) {
                hook.editOriginal("수집 요청을 준비하지 못했습니다. 설정과 허용 출처를 확인하세요.").queue();
              }
            });
  }

  @Override
  public void onButtonInteraction(ButtonInteractionEvent event) {
    if (!event.getComponentId().startsWith("collect-confirm:")) return;
    if (!authorized(
        event.getGuild() == null ? null : event.getGuild().getId(),
        event.getChannel().getId(),
        event.getUser().getId(),
        event.getMember() == null
            ? List.of()
            : event.getMember().getRoles().stream().map(r -> r.getId()).toList())) {
      event.reply("허용된 수집 명령 대상이 아닙니다.").setEphemeral(true).setAllowedMentions(List.of()).queue();
      return;
    }
    event
        .deferReply(true)
        .queue(
            hook -> {
              try {
                UUID id =
                    UUID.fromString(event.getComponentId().substring("collect-confirm:".length()));
                var rows =
                    runs.jdbc()
                        .queryForList(
                            "SELECT * FROM collector.confirmation WHERE id=? AND expires_at>now()",
                            id);
                if (rows.isEmpty()) throw new CollectorFailure(409, "CONFIRMATION_EXPIRED");
                var row = rows.getFirst();
                if (!row.get("actor_hmac").equals(secrets.hmac(event.getUser().getId()))
                    || !row.get("channel_hmac").equals(secrets.hmac(event.getChannel().getId())))
                  throw new CollectorFailure(403, "LOCAL_FORBIDDEN");
                if (row.get("job_request_id") != null) {
                  hook.editOriginal("이미 접수한 작업 ID: " + row.get("job_request_id")).queue();
                  return;
                }
                JsonNode content = Json.parse(spool.get((UUID) row.get("spool_ref")));
                var resolved = intake.resolve(content.path("url").asText());
                var identity = resolved.adapter().identify(URI.create(content.path("url").asText()));
                UUID target =
                    spool.put(Json.bytes(Map.of("channel", content.path("channel").asText())));
                UUID queued = batchStore.queueManual(resolved.key(), identity.postKey(), resolved.canonical(content.path("url").asText()));
                spool.delete((UUID) row.get("spool_ref"));
                spool.delete(target);
                runs.jdbc().update("UPDATE collector.confirmation SET job_request_id=? WHERE id=?", queued, id);
                hook.editOriginal("수집 작업을 batch queue에 접수했습니다. 실행 ID: " + queued).queue();
              } catch (Exception e) {
                hook.editOriginal("수집 요청을 처리하지 못했습니다. 같은 확인 요청을 다시 시도할 수 있습니다.").queue();
              }
            });
  }

  public void notify(UUID ref, String outcome) {
    var target = Json.parse(spool.get(ref));
    var channel = jda.getTextChannelById(target.path("channel").asText());
    if (channel == null) throw new CollectorFailure(503, "DISCORD_UNAVAILABLE");
    channel.sendMessage("수집 처리 결과: " + outcome).setAllowedMentions(List.of()).complete();
  }

  public boolean connected() {
    return jda.getStatus() == JDA.Status.CONNECTED;
  }

  @PreDestroy
  public void close() {
    jda.shutdown();
  }
}
