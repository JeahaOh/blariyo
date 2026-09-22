package com.blariyo.collector.storage;

import com.blariyo.collector.shared.CollectorFailure;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** S3/R2-compatible write boundary owned by the batch process. */
public interface BatchObjectStore {
  Record put(String prefix, byte[] bytes, String contentType);
  record Record(String objectKey, byte[] sha256, long bytes, String contentType) {}

  static BatchObjectStore fromEnvironment() {
    String directory = System.getenv("COLLECTOR_OBJECT_STORE_DIRECTORY");
    if (directory != null && !directory.isBlank()) return new Local(directory);
    String endpoint = first("COLLECTOR_OBJECT_STORE_S3_ENDPOINT", "COLLECTOR_R2_ENDPOINT", "R2_ENDPOINT");
    String bucket = first("COLLECTOR_OBJECT_STORE_S3_BUCKET", "COLLECTOR_R2_BUCKET", "R2_PRIVATE_BUCKET");
    String access = first("COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID", "COLLECTOR_R2_ACCESS_KEY_ID", "R2_PRIVATE_ACCESS_KEY_ID");
    String secret = first("COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY", "COLLECTOR_R2_SECRET_ACCESS_KEY", "R2_PRIVATE_SECRET_ACCESS_KEY");
    if (!endpoint.isBlank() || !bucket.isBlank() || !access.isBlank() || !secret.isBlank()) return new S3Compatible(endpoint, bucket, access, secret);
    String template = System.getenv("COLLECTOR_OBJECT_STORE_PUT_URL_TEMPLATE");
    if (template != null && !template.isBlank()) return new Presigned(template);
    throw new CollectorFailure(503, "BATCH_OBJECT_STORE_REQUIRED");
  }
  private static String first(String... names) {
    for (String name : names) {
      String value = System.getenv(name);
      if (value != null && !value.isBlank()) return value;
    }
    return "";
  }
  private static void validateKey(String prefix) {
    if (!prefix.matches("collect/(raw|media|report)/[A-Za-z0-9._/-]+")) throw new CollectorFailure(400,"OBJECT_KEY_INVALID");
  }
  final class Local implements BatchObjectStore {
    private final Path root;
    public Local(String root) { this.root=Path.of(root).toAbsolutePath().normalize(); }
    public Record put(String prefix, byte[] bytes, String contentType) {
      validateKey(prefix);
      try { Path p=root.resolve(prefix).normalize();if(!p.startsWith(root))throw new IOException();Files.createDirectories(p.getParent());Files.write(p,bytes,StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING);return new Record(prefix,sha(bytes),bytes.length,contentType); }
      catch(IOException e){throw new CollectorFailure(503,"OBJECT_STORE_WRITE_FAILED");}
    }
  }
  final class Presigned implements BatchObjectStore {
    private final String template; private final HttpClient http=HttpClient.newHttpClient();
    public Presigned(String template){this.template=template;}
    public Record put(String prefix,byte[] bytes,String contentType){
      validateKey(prefix);
      String url=template.replace("{key}",URI.create(prefix).getPath().substring(1));
      try {var r=http.send(HttpRequest.newBuilder(URI.create(url)).header("Content-Type",contentType).PUT(HttpRequest.BodyPublishers.ofByteArray(bytes)).build(),HttpResponse.BodyHandlers.discarding());if(r.statusCode()/100!=2)throw new IOException();return new Record(prefix,sha(bytes),bytes.length,contentType);}catch(Exception e){throw new CollectorFailure(503,"OBJECT_STORE_WRITE_FAILED");}
    }
  }
  final class S3Compatible implements BatchObjectStore {
    private static final DateTimeFormatter AMZ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private final URI endpoint; private final String bucket, access, secret; private final HttpClient http=HttpClient.newHttpClient();
    public S3Compatible(String endpoint, String bucket, String access, String secret) {
      if (endpoint.isBlank() || bucket.isBlank() || access.isBlank() || secret.isBlank()) throw new CollectorFailure(503, "BATCH_OBJECT_STORE_REQUIRED");
      URI uri = URI.create(endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length()-1) : endpoint);
      if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null)
        throw new CollectorFailure(503, "BATCH_OBJECT_STORE_REQUIRED");
      if (!bucket.matches("[A-Za-z0-9._-]{3,128}") || access.isBlank() || secret.isBlank()) throw new CollectorFailure(503, "BATCH_OBJECT_STORE_REQUIRED");
      this.endpoint=uri; this.bucket=bucket; this.access=access; this.secret=secret;
    }
    public Record put(String prefix, byte[] bytes, String contentType) {
      validateKey(prefix);
      byte[] digest = sha(bytes);
      URI uri = objectUri(prefix);
      var now = Instant.now();
      String payloadHash = hex(digest);
      try {
        var request = signed("PUT", uri, contentType, payloadHash, now).PUT(HttpRequest.BodyPublishers.ofByteArray(bytes)).build();
        var response = http.send(request, HttpResponse.BodyHandlers.discarding());
        if (response.statusCode()/100 != 2) throw new IOException("put " + response.statusCode());
        var head = signed("HEAD", uri, contentType, "UNSIGNED-PAYLOAD", Instant.now()).method("HEAD", HttpRequest.BodyPublishers.noBody()).build();
        var checked = http.send(head, HttpResponse.BodyHandlers.discarding());
        if (checked.statusCode()/100 != 2) throw new IOException("head " + checked.statusCode());
        return new Record(prefix, digest, bytes.length, contentType);
      } catch (Exception e) { throw new CollectorFailure(503, "OBJECT_STORE_WRITE_FAILED"); }
    }
    private URI objectUri(String key) {
      return endpoint.resolve("/" + encode(bucket) + "/" + Arrays.stream(key.split("/", -1)).map(S3Compatible::encode).reduce((a,b)->a+"/"+b).orElse(""));
    }
    private HttpRequest.Builder signed(String method, URI uri, String contentType, String payloadHash, Instant now) throws Exception {
      String amzDate = AMZ_DATE.format(now), shortDate = SHORT_DATE.format(now), host = uri.getHost();
      if (uri.getPort() != -1) host += ":" + uri.getPort();
      var headers = new TreeMap<String, String>();
      headers.put("content-type", contentType);
      headers.put("host", host);
      headers.put("x-amz-content-sha256", payloadHash);
      headers.put("x-amz-date", amzDate);
      String signedHeaders = String.join(";", headers.keySet());
      StringBuilder canonicalHeaders = new StringBuilder();
      headers.forEach((k,v)->canonicalHeaders.append(k).append(':').append(v).append('\n'));
      String canonicalRequest = method + "\n" + uri.getRawPath() + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;
      String scope = shortDate + "/auto/s3/aws4_request";
      String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hex(sha(canonicalRequest.getBytes(StandardCharsets.UTF_8)));
      byte[] signing = hmac(hmac(hmac(hmac(("AWS4" + secret).getBytes(StandardCharsets.UTF_8), shortDate), "auto"), "s3"), "aws4_request");
      String signature = hex(hmac(signing, stringToSign));
      var builder = HttpRequest.newBuilder(uri)
          .header("Content-Type", contentType)
          .header("X-Amz-Content-Sha256", payloadHash)
          .header("X-Amz-Date", amzDate)
          .header("Authorization", "AWS4-HMAC-SHA256 Credential=" + access + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature);
      return builder;
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20"); }
    private static byte[] hmac(byte[] key, String value) throws Exception {
      Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(key, "HmacSHA256")); return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    }
  }
  static byte[] sha(byte[] bytes){try{return MessageDigest.getInstance("SHA-256").digest(bytes);}catch(Exception e){throw new IllegalStateException(e);}}
  static String hex(byte[] bytes){return HexFormat.of().formatHex(bytes);}
}
