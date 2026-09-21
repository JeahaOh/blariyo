package com.blariyo.collector.source;

import java.net.URI;
import java.util.*;
import java.util.regex.Pattern;

/** Longest matching group/rule, wildcard and query handling. Unknown responses fail closed. */
public final class RobotsRules {
  private record Rule(boolean allow, String path) {}
  private static final class Group {
    final List<String> agents = new ArrayList<>();
    final List<Rule> rules = new ArrayList<>();
    long delay;
    boolean directives;
  }
  private final List<Group> groups = new ArrayList<>();
  private boolean valid;
  public RobotsRules(String text) {
    if (text == null || text.stripLeading().startsWith("<") || text.length() > 512 * 1024) return;
    Group group = null;
    for (String raw : text.split("\\R")) {
      String[] field = raw.split("#", 2)[0].strip().split(":", 2);
      if (field.length != 2) continue;
      String key = field[0].strip().toLowerCase(Locale.ROOT), value = field[1].strip();
      if (key.equals("user-agent")) {
        if (group == null || group.directives) { group = new Group(); groups.add(group); }
        if (!value.isBlank()) group.agents.add(value.toLowerCase(Locale.ROOT));
        valid = true;
      } else if (group != null) {
        group.directives = true;
        if (Set.of("allow", "disallow").contains(key) && !value.isBlank())
          group.rules.add(new Rule(key.equals("allow"), value));
        if (key.equals("crawl-delay")) {
          try { group.delay = Math.max(group.delay, (long) Math.ceil(Double.parseDouble(value) * 1000)); }
          catch (NumberFormatException e) { valid = false; return; }
        }
      }
    }
  }
  private List<Group> applicable(String agent) {
    int longest = -1;
    var selected = new ArrayList<Group>();
    for (Group group : groups) {
      int specificity = group.agents.stream().filter(a -> a.equals("*") || agent.toLowerCase(Locale.ROOT).contains(a))
          .mapToInt(a -> a.equals("*") ? 0 : a.length()).max().orElse(-1);
      if (specificity < 0 || specificity < longest) continue;
      if (specificity > longest) { selected.clear(); longest = specificity; }
      selected.add(group);
    }
    return selected;
  }
  public boolean allows(String agent, URI uri) {
    if (!valid) return false;
    String target = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    int longest = -1;
    boolean allowed = true;
    for (var group : applicable(agent)) for (var rule : group.rules) {
      String path = rule.path(); boolean end = path.endsWith("$");
      if (end) path = path.substring(0, path.length() - 1);
      String regex = Arrays.stream(path.split("\\*", -1)).map(Pattern::quote).collect(java.util.stream.Collectors.joining(".*"));
      int length = path.replace("*", "").length();
      if (Pattern.compile("^" + regex + (end ? "$" : "")).matcher(target).find()
          && (length > longest || length == longest && rule.allow())) {
        longest = length; allowed = rule.allow();
      }
    }
    return allowed;
  }
  public long delayMillis(String agent) { return applicable(agent).stream().mapToLong(g -> g.delay).max().orElse(0); }
}
