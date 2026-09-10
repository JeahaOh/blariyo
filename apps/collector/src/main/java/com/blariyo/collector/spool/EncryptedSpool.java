package com.blariyo.collector.spool;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.shared.CollectorFailure;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class EncryptedSpool {
  private final Path root;
  private final Secrets secrets;

  public EncryptedSpool(@Value("${collector.spool-directory}") String directory, Secrets secrets) {
    this.root = Path.of(directory).toAbsolutePath().normalize();
    this.secrets = secrets;
  }

  private void prepare() throws Exception {
    for (Path ancestor = root; ancestor != null; ancestor = ancestor.getParent())
      if (Files.isSymbolicLink(ancestor)) throw new CollectorFailure(503, "SPOOL_PERMISSIONS");
    Files.createDirectories(
        root, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
    if (!Files.getPosixFilePermissions(root).equals(PosixFilePermissions.fromString("rwx------")))
      throw new CollectorFailure(503, "SPOOL_PERMISSIONS");
  }

  private Path path(UUID ref) {
    return root.resolve(ref.toString() + ".enc");
  }

  public UUID put(byte[] bytes) {
    UUID ref = UUID.randomUUID();
    write(ref, bytes);
    return ref;
  }

  public void write(UUID ref, byte[] bytes) {
    Path temp = null;
    try {
      prepare();
      byte[] nonce = new byte[12];
      new SecureRandom().nextBytes(nonce);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.ENCRYPT_MODE,
          new SecretKeySpec(secrets.key("spool-key"), "AES"),
          new GCMParameterSpec(128, nonce));
      cipher.updateAAD(ref.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      byte[] encrypted = cipher.doFinal(bytes);
      temp =
          Files.createTempFile(
              root,
              ".write-",
              ".tmp",
              PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
      try (var channel = java.nio.channels.FileChannel.open(temp, StandardOpenOption.WRITE)) {
        var buffer = ByteBuffer.allocate(12 + encrypted.length).put(nonce).put(encrypted).flip();
        while (buffer.hasRemaining()) channel.write(buffer);
        channel.force(true);
      }
      Files.move(
          temp, path(ref), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(503, "SPOOL_WRITE_FAILED");
    } finally {
      if (temp != null)
        try {
          Files.deleteIfExists(temp);
        } catch (Exception ignored) {
        }
    }
  }

  public byte[] get(UUID ref) {
    try {
      prepare();
      Path p = path(ref);
      if (Files.isSymbolicLink(p)
          || !Files.getPosixFilePermissions(p).equals(PosixFilePermissions.fromString("rw-------")))
        throw new CollectorFailure(503, "SPOOL_PERMISSIONS");
      if (Files.size(p) > 12 * 1024 * 1024) throw new CollectorFailure(503, "SPOOL_INVALID");
      byte[] raw = Files.readAllBytes(p);
      if (raw.length < 28) throw new CollectorFailure(503, "SPOOL_INVALID");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.DECRYPT_MODE,
          new SecretKeySpec(secrets.key("spool-key"), "AES"),
          new GCMParameterSpec(128, Arrays.copyOf(raw, 12)));
      cipher.updateAAD(ref.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      return cipher.doFinal(raw, 12, raw.length - 12);
    } catch (CollectorFailure e) {
      throw e;
    } catch (Exception e) {
      throw new CollectorFailure(503, "SPOOL_DECRYPT_FAILED");
    }
  }

  public long[] stats() {
    try {
      prepare();
      long count = 0, bytes = 0;
      try (var files = Files.list(root)) {
        for (Path file : files.toList())
          if (Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            count++;
            bytes += Files.size(file);
          }
      }
      return new long[] {count, bytes};
    } catch (Exception e) {
      throw new CollectorFailure(503, "SPOOL_UNAVAILABLE");
    }
  }

  public void removeOrphans(Set<UUID> referenced) {
    try {
      prepare();
      long threshold = System.currentTimeMillis() - 3600000;
      try (var files = Files.list(root)) {
        for (Path file : files.toList()) {
          if (Files.isSymbolicLink(file)
              || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)
              || Files.getLastModifiedTime(file).toMillis() >= threshold) continue;
          String name = file.getFileName().toString();
          if (name.startsWith(".write-") && name.endsWith(".tmp")) {
            Files.deleteIfExists(file);
            continue;
          }
          if (!name.matches("[a-f0-9-]{36}\\.enc")) continue;
          UUID ref = UUID.fromString(name.substring(0, 36));
          if (!referenced.contains(ref)) Files.deleteIfExists(file);
        }
      }
    } catch (Exception e) {
      throw new CollectorFailure(503, "SPOOL_CLEANUP_FAILED");
    }
  }

  public void delete(UUID ref) {
    try {
      Files.deleteIfExists(path(ref));
    } catch (Exception e) {
      throw new CollectorFailure(503, "SPOOL_CLEANUP_FAILED");
    }
  }
}
