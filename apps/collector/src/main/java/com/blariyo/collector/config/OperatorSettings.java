package com.blariyo.collector.config;

import java.nio.file.*;
import java.util.Properties;
import org.springframework.core.env.StandardEnvironment;

/** Non-secret operator properties shared by explicit migration and backup commands. */
public final class OperatorSettings {
  private static final Properties properties = new Properties();

  public static void load(String file) throws Exception {
    Path path = Path.of(file);
    if (Files.isSymbolicLink(path)
        || !Files.isRegularFile(path)
        || Files.getPosixFilePermissions(path).stream()
            .anyMatch(p -> p.name().startsWith("GROUP_") || p.name().startsWith("OTHERS_")))
      throw new IllegalArgumentException();
    try (var reader = Files.newBufferedReader(path)) {
      properties.clear();
      properties.load(reader);
    }
    for (String key : properties.stringPropertyNames())
      if (key.toLowerCase().contains("password")
          || key.toLowerCase().contains("token")
          || key.endsWith("-key")
          || properties.getProperty(key).contains("${")) throw new IllegalArgumentException();
  }

  public static String get(String property, String environment, String fallback) {
    String value = properties.getProperty(property);
    return value == null ? System.getenv().getOrDefault(environment, fallback) : value;
  }

  public static String url() {
    return get("spring.datasource.url", "COLLECTOR_DATABASE_URL", null);
  }

  public static String user() {
    return get("spring.datasource.username", "COLLECTOR_DATABASE_USER", "collector");
  }

  public static String password() {
    String explicit = System.getenv("COLLECTOR_DATABASE_PASSWORD");
    return explicit != null
        ? explicit
        : new Secrets(new StandardEnvironment()).require("database-password");
  }
}
