package com.blariyo.collector.config;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.util.*;
import java.util.concurrent.TimeUnit;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public final class Secrets {
  private final Environment env;

  public Secrets(Environment env) {
    this.env = env;
  }

  public String require(String account) {
    if (!account.matches("[a-zA-Z0-9.-]{1,80}"))
      throw new CollectorFailure(503, "KEYCHAIN_UNAVAILABLE");
    String fixture = env.getProperty("collector.fixture-secrets");
    try {
      if (fixture != null) {
        if (!Arrays.asList(env.getActiveProfiles()).contains("fixture"))
          throw new CollectorFailure(503, "FIXTURE_SECRET_FORBIDDEN");
        Path path = Path.of(fixture);
        if (Files.isSymbolicLink(path)
            || !Files.getPosixFilePermissions(path)
                .equals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)))
          throw new CollectorFailure(503, "SECRET_PERMISSIONS");
        var value = Json.parse(Files.readAllBytes(path)).path(account);
        if (value.isMissingNode() || value.asText().isBlank())
          throw new CollectorFailure(503, "SECRET_REQUIRED");
        return value.asText();
      }
      Process p =
          new ProcessBuilder(
                  "/usr/bin/security",
                  "find-generic-password",
                  "-s",
                  "com.blariyo.collector",
                  "-a",
                  account,
                  "-w")
              .redirectError(ProcessBuilder.Redirect.DISCARD)
              .start();
      if (!p.waitFor(5, TimeUnit.SECONDS)) {
        p.destroyForcibly();
        throw new CollectorFailure(503, "KEYCHAIN_UNAVAILABLE");
      }
      if (p.exitValue() != 0) throw new CollectorFailure(503, "KEYCHAIN_UNAVAILABLE");
      String value =
          new String(p.getInputStream().readNBytes(4096), java.nio.charset.StandardCharsets.UTF_8)
              .strip();
      if (value.isBlank()) throw new CollectorFailure(503, "KEYCHAIN_UNAVAILABLE");
      return value;
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(503, "KEYCHAIN_UNAVAILABLE");
    }
  }

  public byte[] key(String account) {
    try {
      byte[] key = Base64.getDecoder().decode(require(account));
      if (key.length != 32) throw new IllegalArgumentException();
      return key;
    } catch (Exception e) {
      throw new CollectorFailure(503, "KEY_MATERIAL_INVALID");
    }
  }

  public String hmac(String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key("request-key"), "HmacSHA256"));
      return HexFormat.of()
          .formatHex(mac.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(503, "KEY_MATERIAL_INVALID");
    }
  }
}
