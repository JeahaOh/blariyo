package com.blariyo.collector.ops;

import com.blariyo.collector.config.OperatorSettings;
import com.blariyo.collector.config.Secrets;
import java.io.*;
import java.net.URI;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.core.env.StandardEnvironment;

/** Explicit operator CLI. Backups never write an unencrypted database dump to disk. */
public final class BackupMain {
  private static final byte[] HEADER =
      "BLARIYO-COLLECTOR-BACKUP-1\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
  private static final long MAXIMUM = 256L * 1024 * 1024;

  public static void main(String[] args) {
    try {
      if ((args.length != 2 && args.length != 3) || !Set.of("backup", "restore").contains(args[0]))
        throw new IllegalArgumentException();
      if (args.length == 3) OperatorSettings.load(args[2]);
      var secrets = new Secrets(new StandardEnvironment());
      if (args[0].equals("backup")) backup(Path.of(args[1]), secrets);
      else restore(Path.of(args[1]), secrets);
      System.out.println("COLLECTOR_" + args[0].toUpperCase(Locale.ROOT) + "_COMPLETE");
    } catch (Exception e) {
      System.err.println("COLLECTOR_BACKUP_OPERATION_FAILED");
      System.exit(1);
    }
  }

  private static Cipher cipher(int mode, byte[] key, byte[] nonce) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
    cipher.updateAAD(HEADER);
    return cipher;
  }

  static void encrypt(InputStream input, OutputStream output, byte[] key) throws Exception {
    byte[] nonce = new byte[12];
    new SecureRandom().nextBytes(nonce);
    output.write(HEADER);
    output.write(nonce);
    try (var encrypted = new CipherOutputStream(output, cipher(Cipher.ENCRYPT_MODE, key, nonce))) {
      transferBounded(input, encrypted);
    }
  }

  static void decrypt(InputStream input, OutputStream output, byte[] key) throws Exception {
    if (!Arrays.equals(HEADER, input.readNBytes(HEADER.length))) throw new IOException();
    byte[] nonce = input.readNBytes(12);
    if (nonce.length != 12) throw new IOException();
    try (var decrypted = new CipherInputStream(input, cipher(Cipher.DECRYPT_MODE, key, nonce))) {
      transferBounded(decrypted, output);
    }
  }

  private static void transferBounded(InputStream input, OutputStream output) throws IOException {
    byte[] buffer = new byte[65536];
    long total = 0;
    int count;
    while ((count = input.read(buffer)) != -1) {
      total += count;
      if (total > MAXIMUM) throw new IOException("BACKUP_SIZE_LIMIT");
      output.write(buffer, 0, count);
    }
  }

  private static Process command(String tool, List<String> args) throws Exception {
    String binary =
        OperatorSettings.get(
            "collector." + tool,
            "COLLECTOR_" + tool.toUpperCase(Locale.ROOT).replace('-', '_'),
            null);
    if (binary == null || !Path.of(binary).isAbsolute() || !Files.isExecutable(Path.of(binary)))
      throw new IOException();
    URI db = URI.create(OperatorSettings.url().substring(5));
    if (!"postgresql".equals(db.getScheme())
        || !Set.of("127.0.0.1", "localhost", "[::1]", "::1").contains(db.getHost())
        || db.getUserInfo() != null
        || db.getQuery() != null
        || !db.getPath().matches("/[a-zA-Z0-9_]+")) throw new IOException();
    var command = new ArrayList<String>();
    command.add(binary);
    command.addAll(args);
    var builder = new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD);
    var env = builder.environment();
    env.put("PGHOST", db.getHost());
    env.put("PGPORT", Integer.toString(db.getPort() == -1 ? 5432 : db.getPort()));
    env.put("PGDATABASE", db.getPath().substring(1));
    env.put("PGUSER", OperatorSettings.user());
    env.put("PGPASSWORD", OperatorSettings.password());
    env.put("PGCONNECT_TIMEOUT", "5");
    return builder.start();
  }

  private static ScheduledExecutorService deadline(Process process) {
    var timer = Executors.newSingleThreadScheduledExecutor();
    timer.schedule(process::destroyForcibly, 120, TimeUnit.SECONDS);
    return timer;
  }

  public static void backup(Path directory, Secrets secrets) throws Exception {
    directory = directory.toAbsolutePath().normalize();
    if (Files.isSymbolicLink(directory)) throw new IOException();
    Files.createDirectories(
        directory,
        PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
    if (!Files.getPosixFilePermissions(directory)
        .equals(PosixFilePermissions.fromString("rwx------"))) throw new IOException();
    Path temporary =
        Files.createTempFile(
            directory,
            ".backup-",
            ".tmp",
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    Process process = null;
    ScheduledExecutorService timer = null;
    try {
      byte[] key = secrets.key("backup-key");
      process =
          command(
              "pg-dump",
              List.of(
                  "--format=custom",
                  "--no-owner",
                  "--no-acl",
                  "--exclude-table-data=collector.restore_gate"));
      timer = deadline(process);
      try (var output = Files.newOutputStream(temporary)) {
        encrypt(process.getInputStream(), output, key);
      }
      if (process.waitFor() != 0) throw new IOException();
      try (var channel = java.nio.channels.FileChannel.open(temporary, StandardOpenOption.WRITE)) {
        channel.force(true);
      }
      Path target =
          directory.resolve(
              "collector-" + Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + ".enc");
      Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
      try (var list = Files.list(directory)) {
        var backups =
            list.filter(
                    p ->
                        p.getFileName().toString().matches("collector-[0-9]+-[a-f0-9-]{36}\\.enc")
                            && !Files.isSymbolicLink(p))
                .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                .toList();
        for (int i = 7; i < backups.size(); i++) Files.delete(backups.get(i));
      }
    } finally {
      if (timer != null) timer.shutdownNow();
      if (process != null && process.isAlive()) process.destroyForcibly();
      Files.deleteIfExists(temporary);
    }
  }

  public static void restore(Path archive, Secrets secrets) throws Exception {
    if (Files.isSymbolicLink(archive)
        || Files.size(archive) > MAXIMUM + 1024
        || !Files.getPosixFilePermissions(archive)
            .equals(PosixFilePermissions.fromString("rw-------"))) throw new IOException();
    byte[] key = secrets.key("backup-key");
    // Verify authenticity completely before opening a restore connection.
    try (var input = Files.newInputStream(archive)) {
      decrypt(input, OutputStream.nullOutputStream(), key);
    }
    String url = OperatorSettings.url(),
        user = OperatorSettings.user(),
        password = OperatorSettings.password();
    try (Connection db = DriverManager.getConnection(url, user, password);
        var sql = db.createStatement()) {
      try (var rows =
          sql.executeQuery(
              "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE"
                  + " n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE"
                  + " 'pg_toast%' AND c.relkind IN ('r','p','v','m','S')")) {
        rows.next();
        if (rows.getInt(1) != 0) throw new IOException("RESTORE_REQUIRES_EMPTY_DATABASE");
      }
    }
    Process process =
        command(
            "pg-restore",
            List.of(
                "--dbname=" + URI.create(url.substring(5)).getPath().substring(1),
                "--single-transaction",
                "--exit-on-error",
                "--no-owner",
                "--no-acl"));
    var timer = deadline(process);
    try {
      try (var input = Files.newInputStream(archive);
          var output = process.getOutputStream()) {
        decrypt(input, output, key);
      }
      if (process.waitFor() != 0) throw new IOException();
      try (Connection db = DriverManager.getConnection(url, user, password);
          var sql = db.createStatement()) {
        sql.execute(
            "INSERT INTO collector.restore_gate(singleton,reconcile_required) VALUES(true,true) ON"
                + " CONFLICT(singleton) DO UPDATE SET reconcile_required=true");
        sql.execute(
            "UPDATE collector.run SET"
                + " state='RECONCILE_REQUIRED',restartable=false,outcome='RESTORED_DATABASE' WHERE"
                + " state IN ('QUEUED','RUNNING','STOP_REQUESTED','STOPPED','FAILED')");
      }
    } finally {
      timer.shutdownNow();
      if (process.isAlive()) process.destroyForcibly();
    }
  }
}
