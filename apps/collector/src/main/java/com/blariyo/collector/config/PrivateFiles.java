package com.blariyo.collector.config;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.*;

/** Owner-only POSIX permissions or Windows ACLs; unsupported filesystems fail closed. */
public final class PrivateFiles {
  private PrivateFiles() {}

  public static void check(Path path, boolean directory) throws IOException {
    path = path.toAbsolutePath().normalize();
    for (Path parent = path; parent != null; parent = parent.getParent())
      if (Files.isSymbolicLink(parent)) throw new IOException("PRIVATE_PATH_REQUIRED");
    if (directory ? !Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)
        : !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) throw new IOException("PRIVATE_PATH_REQUIRED");
    if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
      var permissions = Files.getPosixFilePermissions(path);
      if (permissions.stream().anyMatch(p -> p.name().startsWith("GROUP_") || p.name().startsWith("OTHERS_"))
          || !permissions.contains(PosixFilePermission.OWNER_READ)
          || directory && !permissions.contains(PosixFilePermission.OWNER_EXECUTE))
        throw new IOException("PRIVATE_PERMISSIONS_REQUIRED");
    } else {
      var acl = Files.getFileAttributeView(path, AclFileAttributeView.class, LinkOption.NOFOLLOW_LINKS);
      if (acl == null || !ownerOnly(acl.getOwner(), acl.getAcl()))
        throw new IOException("PRIVATE_ACL_REQUIRED");
    }
  }

  static boolean ownerOnly(UserPrincipal owner, List<AclEntry> entries) {
    return entries.stream().noneMatch(e -> e.type() == AclEntryType.ALLOW
        && !e.flags().contains(AclEntryFlag.INHERIT_ONLY) && !e.principal().equals(owner)
        && !e.permissions().isEmpty());
  }

  private static FileAttribute<?> attribute(Path parent, boolean directory) throws IOException {
    Path existing = parent.toAbsolutePath();
    while (!Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) existing = existing.getParent();
    if (Files.getFileStore(existing).supportsFileAttributeView("posix"))
      return PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString(directory ? "rwx------" : "rw-------"));
    var owner = parent.getFileSystem().getUserPrincipalLookupService().lookupPrincipalByName(System.getProperty("user.name"));
    var builder = AclEntry.newBuilder().setType(AclEntryType.ALLOW).setPrincipal(owner)
        .setPermissions(EnumSet.allOf(AclEntryPermission.class));
    if (directory) builder.setFlags(AclEntryFlag.FILE_INHERIT, AclEntryFlag.DIRECTORY_INHERIT);
    var entries = List.of(builder.build());
    return new FileAttribute<List<AclEntry>>() {
      public String name() { return "acl:acl"; }
      public List<AclEntry> value() { return entries; }
    };
  }

  public static void directory(Path path) throws IOException {
    Files.createDirectories(path, attribute(path, true));
    check(path, true);
  }
  public static Path temporary(Path parent, String prefix) throws IOException {
    check(parent, true);
    return Files.createTempFile(parent, prefix, ".tmp", attribute(parent, false));
  }
}
