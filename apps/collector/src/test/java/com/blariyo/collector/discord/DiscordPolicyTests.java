package com.blariyo.collector.discord;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;

class DiscordPolicyTests {
  @Test
  void discordAllowsOnlyAnApprovedGuildChannelAndUserOrRole() {
    var policy =
        new DiscordPolicy(
            Set.of("guild"), Set.of("channel"), Set.of("operator"), Set.of("moderator"));
    assertTrue(policy.authorized("guild", "channel", "operator", List.of()));
    assertTrue(policy.authorized("guild", "channel", "member", List.of("moderator")));
    assertFalse(policy.authorized(null, "channel", "operator", List.of("moderator")));
    assertFalse(policy.authorized("other", "channel", "operator", List.of()));
    assertFalse(policy.authorized("guild", "other", "operator", List.of()));
    assertFalse(policy.authorized("guild", "channel", "member", List.of("visitor")));
    assertThrows(
        CollectorFailure.class,
        () -> new DiscordPolicy(Set.of("guild"), Set.of("channel"), Set.of(), Set.of()));
  }
}
