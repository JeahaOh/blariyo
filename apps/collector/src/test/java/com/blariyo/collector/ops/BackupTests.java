package com.blariyo.collector.ops;

import static org.junit.jupiter.api.Assertions.*;

import java.net.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;

class BackupTests {
  @Test
  void backupAuthenticatesBeforeRestoreAndRejectsTampering() throws Exception {
    byte[] key = new byte[32], data = "fixture database content".getBytes();
    new java.security.SecureRandom().nextBytes(key);
    var encrypted = new java.io.ByteArrayOutputStream();
    BackupMain.encrypt(new java.io.ByteArrayInputStream(data), encrypted, key);
    byte[] archive = encrypted.toByteArray();
    assertFalse(new String(archive).contains("fixture database content"));
    var restored = new java.io.ByteArrayOutputStream();
    BackupMain.decrypt(new java.io.ByteArrayInputStream(archive), restored, key);
    assertArrayEquals(data, restored.toByteArray());
    archive[archive.length - 1] ^= 1;
    assertThrows(
        Exception.class,
        () ->
            BackupMain.decrypt(
                new java.io.ByteArrayInputStream(archive),
                java.io.OutputStream.nullOutputStream(),
                key));
  }
}
