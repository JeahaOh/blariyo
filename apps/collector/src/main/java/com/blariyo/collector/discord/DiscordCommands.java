package com.blariyo.collector.discord;

import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.build.*;

/** Explicit guild-scoped registration only, enabled by operator configuration. */
public final class DiscordCommands {
  private DiscordCommands() {}
  public static SlashCommandData collect() {
    return Commands.slash("collect", "수집 후보 접수와 상태 조회")
        .addSubcommands(new SubcommandData("url", "공개 원문 URL 수집 확인")
            .addOption(OptionType.STRING,"url","수집할 공개 원문 URL",true),
            new SubcommandData("status", "수집 처리 상태 조회"));
  }
}
