package com.blariyo.collector.discord;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.run.BatchStore;
import com.blariyo.collector.run.BatchQueueStore;
import com.blariyo.collector.source.SourceRegistry;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.spool.EncryptedSpool;
import jakarta.annotation.PreDestroy;
import java.net.URI;
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

@Component
@ConditionalOnProperty(name = "collector.discord-enabled", havingValue = "true")
public final class DiscordGateway extends ListenerAdapter {
  private final EncryptedSpool spool;
  private final Environment env;
  private final JDA jda;
  private final BatchDiscordIntake intake;
  private final BatchQueueStore queue;

  public DiscordGateway(Secrets secrets, EncryptedSpool spool, Environment env, BatchStore batchStore) {
    this.spool = spool;
    this.env = env;
    this.queue = new BatchQueueStore(batchStore);
    this.intake = new BatchDiscordIntake(queue,
        () -> SourceRegistry.read(env.getProperty("collector.sources-file", "apps/collector/ops/reference-sites.sources.example.json")), secrets::hmac);
    if (allowed("guilds").isEmpty()
        || allowed("channels").isEmpty()
        || allowed("users").isEmpty() && allowed("roles").isEmpty())
      throw new CollectorFailure(503, "DISCORD_ALLOWLIST_REQUIRED");
    if (org.slf4j.LoggerFactory.getLogger("net.dv8tion.jda") instanceof ch.qos.logback.classic.Logger logger)
      logger.setLevel(ch.qos.logback.classic.Level.OFF);
    jda =
        JDABuilder.createLight(
                secrets.require("discord-token"), EnumSet.noneOf(GatewayIntent.class))
            .addEventListeners(this)
            .build();
  }

  @Override
  public void onReady(net.dv8tion.jda.api.events.session.ReadyEvent event) {
    System.out.println("{\"event\":\"DISCORD_GATEWAY_CONNECTED\"}");
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
    return value.isBlank() ? Set.of() : new HashSet<>(Arrays.stream(value.split(",")).map(String::strip).filter(v -> !v.isBlank()).toList());
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
                  hook.editOriginal("batch 수집 상태: " + queue.counts()).queue();
                  return;
                }
                if (!"url".equals(event.getSubcommandName()) || event.getOption("url") == null) {
                  hook.editOriginal("URL 수집 또는 상태 조회 명령을 사용하세요.").queue();
                  return;
                }
                var confirmation = intake.prepare(event.getId(), event.getUser().getId(), event.getChannel().getId(), event.getOption("url").getAsString());
                String url = confirmation.url();
                URI uri = URI.create(url);
                hook.editOriginal(
                        "출처: "
                            + confirmation.source() + " (" + uri.getHost() + ")"
                            + "\n대상: "
                            + url
                            + "\nrobots·상세·이미지 요청이 발생하며 검수 후에만 발행됩니다.")
                    .setComponents(
                        ActionRow.of(Button.primary("collect-confirm:" + confirmation.id(), "수집 확인")))
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
                UUID queued = intake.confirm(id, event.getUser().getId(), event.getChannel().getId());
                hook.editOriginal("수집 작업을 batch queue에 접수했습니다. 요청 ID: " + queued).queue();
              } catch (Exception e) {
                hook.editOriginal("수집 요청을 처리하지 못했습니다. 같은 확인 요청을 다시 시도할 수 있습니다.").queue();
              }
            });
  }

  public void notify(UUID ref, String outcome) {
    if (spool == null) throw new CollectorFailure(503,"LEGACY_NOTIFICATION_DISABLED");
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
