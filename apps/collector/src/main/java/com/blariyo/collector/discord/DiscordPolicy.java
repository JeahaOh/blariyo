package com.blariyo.collector.discord;

import com.blariyo.collector.shared.CollectorFailure;
import java.util.*;

public record DiscordPolicy(
    Set<String> guilds, Set<String> channels, Set<String> users, Set<String> roles) {
  public DiscordPolicy {
    guilds = Set.copyOf(guilds);
    channels = Set.copyOf(channels);
    users = Set.copyOf(users);
    roles = Set.copyOf(roles);
    if (guilds.isEmpty() || channels.isEmpty() || users.isEmpty() && roles.isEmpty())
      throw new CollectorFailure(503, "DISCORD_ALLOWLIST_REQUIRED");
  }

  public boolean authorized(String guild, String channel, String user, List<String> memberRoles) {
    return guild != null
        && guilds.contains(guild)
        && channels.contains(channel)
        && (users.contains(user) || memberRoles.stream().anyMatch(roles::contains));
  }
}
