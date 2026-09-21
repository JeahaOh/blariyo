package com.blariyo.collector.config;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;

class PrivateFilesTests {
  @TempDir Path directory;
  @Test void privateSecretFilesAreReadWithoutKeychainAndUnsafeFilesRejected() throws Exception {
    Path root = directory.toRealPath().resolve("private");
    PrivateFiles.directory(root);
    Path file = root.resolve("core-token");
    Files.writeString(file, "synthetic-token\n");
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("r--------"));
    var secrets = new Secrets(new MockEnvironment().withProperty("collector.secrets-directory", root.toString()));
    assertEquals("synthetic-token", secrets.require("core-token"));
    assertThrows(CollectorFailure.class, () -> secrets.require("../core-token"));
    Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-r--r--"));
    assertThrows(CollectorFailure.class, () -> secrets.require("core-token"));
    Path alias = root.resolve("alias"); Files.createSymbolicLink(alias,file);
    assertThrows(CollectorFailure.class, () -> secrets.require("alias"));
  }
  @Test void windowsAclPolicyRequiresOwnerOnlyAccess() {
    UserPrincipal owner = () -> "owner", other = () -> "other";
    var own = AclEntry.newBuilder().setType(AclEntryType.ALLOW).setPrincipal(owner).setPermissions(AclEntryPermission.READ_DATA).build();
    var foreign = AclEntry.newBuilder().setType(AclEntryType.ALLOW).setPrincipal(other).setPermissions(AclEntryPermission.READ_DATA).build();
    assertTrue(PrivateFiles.ownerOnly(owner,List.of(own)));
    assertFalse(PrivateFiles.ownerOnly(owner,List.of(own,foreign)));
  }
}
