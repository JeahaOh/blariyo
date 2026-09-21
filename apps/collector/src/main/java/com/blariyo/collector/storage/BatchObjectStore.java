package com.blariyo.collector.storage;

import com.blariyo.collector.shared.CollectorFailure;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;

/** S3/R2-compatible write boundary. A presigned PUT URL is supplied by the batch operator. */
public interface BatchObjectStore {
  Record put(String prefix, byte[] bytes, String contentType);
  record Record(String objectKey, byte[] sha256, long bytes, String contentType) {}

  static BatchObjectStore fromEnvironment() {
    String directory = System.getenv("COLLECTOR_OBJECT_STORE_DIRECTORY");
    if (directory != null && !directory.isBlank()) return new Local(directory);
    String template = System.getenv("COLLECTOR_OBJECT_STORE_PUT_URL_TEMPLATE");
    if (template != null && !template.isBlank()) return new Presigned(template);
    throw new CollectorFailure(503, "BATCH_OBJECT_STORE_REQUIRED");
  }
  final class Local implements BatchObjectStore {
    private final Path root;
    public Local(String root) { this.root=Path.of(root).toAbsolutePath().normalize(); }
    public Record put(String prefix, byte[] bytes, String contentType) {
      if (!prefix.matches("collect/(raw|media|report)/[A-Za-z0-9._/-]+")) throw new CollectorFailure(400,"OBJECT_KEY_INVALID");
      try { Path p=root.resolve(prefix).normalize();if(!p.startsWith(root))throw new IOException();Files.createDirectories(p.getParent());Files.write(p,bytes,StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING);return new Record(prefix,sha(bytes),bytes.length,contentType); }
      catch(IOException e){throw new CollectorFailure(503,"OBJECT_STORE_WRITE_FAILED");}
    }
  }
  final class Presigned implements BatchObjectStore {
    private final String template; private final HttpClient http=HttpClient.newHttpClient();
    public Presigned(String template){this.template=template;}
    public Record put(String prefix,byte[] bytes,String contentType){
      String url=template.replace("{key}",URI.create(prefix).getPath().substring(1));
      try {var r=http.send(HttpRequest.newBuilder(URI.create(url)).header("Content-Type",contentType).PUT(HttpRequest.BodyPublishers.ofByteArray(bytes)).build(),HttpResponse.BodyHandlers.discarding());if(r.statusCode()/100!=2)throw new IOException();return new Record(prefix,sha(bytes),bytes.length,contentType);}catch(Exception e){throw new CollectorFailure(503,"OBJECT_STORE_WRITE_FAILED");}
    }
  }
  static byte[] sha(byte[] bytes){try{return MessageDigest.getInstance("SHA-256").digest(bytes);}catch(Exception e){throw new IllegalStateException(e);}}
  static String hex(byte[] bytes){return HexFormat.of().formatHex(bytes);}
}
