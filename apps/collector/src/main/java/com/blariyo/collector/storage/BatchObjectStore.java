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
    return fromEnvironment(System.getenv());
  }
  static BatchObjectStore fromEnvironment(Map<String,String> environment) {
    String directory = environment.get("COLLECTOR_OBJECT_STORE_DIRECTORY");
    if (directory != null && !directory.isBlank()) return new Local(directory);
    String endpoint = first(environment,"COLLECTOR_OBJECT_STORE_S3_ENDPOINT", "COLLECTOR_R2_ENDPOINT");
    String bucket = first(environment,"COLLECTOR_OBJECT_STORE_S3_BUCKET", "COLLECTOR_R2_BUCKET");
    String access = first(environment,"COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID", "COLLECTOR_R2_ACCESS_KEY_ID");
    String secret = first(environment,"COLLECTOR_OBJECT_STORE_S3_SECRET_ACCESS_KEY", "COLLECTOR_R2_SECRET_ACCESS_KEY");
    if (!endpoint.isBlank() || !bucket.isBlank() || !access.isBlank() || !secret.isBlank()) return new S3Compatible(endpoint, bucket, access, secret);
    String template = environment.get("COLLECTOR_OBJECT_STORE_PUT_URL_TEMPLATE");
    if (template != null && !template.isBlank()) return new Presigned(template);
    throw new CollectorFailure(503, "BATCH_OBJECT_STORE_REQUIRED");
  }
  private static String first(Map<String,String> environment,String... names) {
    for (String name : names) {
      String value = environment.get(name);
      if (value != null && !value.isBlank()) return value;
    }
    return "";
  }
  static void validateKey(String prefix) {
    if (!prefix.matches("collect/(raw|media|report)/[A-Za-z0-9._/-]+") || Arrays.stream(prefix.split("/", -1)).anyMatch(s -> s.isEmpty() || s.equals(".") || s.equals(".."))) throw new CollectorFailure(400,"OBJECT_KEY_INVALID");
  }
  static void validateInventoryPrefix(String prefix) {
    if (!Set.of("collect/raw/", "collect/media/", "collect/report/").contains(prefix)) {
      validateKey(prefix.endsWith("/") ? prefix.substring(0, prefix.length()-1) : prefix);
    }
  }
  final class Local implements BatchObjectStore, RetentionObjects {
    private final Path root;
    public Local(String root) { this.root=Path.of(root).toAbsolutePath().normalize(); }
    public Record put(String prefix, byte[] bytes, String contentType) {
      validateKey(prefix);
      try { Path p=root.resolve(prefix).normalize();if(!p.startsWith(root))throw new IOException();Files.createDirectories(p.getParent());Files.write(p,bytes,StandardOpenOption.CREATE,StandardOpenOption.TRUNCATE_EXISTING);return new Record(prefix,sha(bytes),bytes.length,contentType); }
      catch(IOException e){throw new CollectorFailure(503,"OBJECT_STORE_WRITE_FAILED");}
    }
    private Path retainedPath(String key) throws IOException {
      validateKey(key);
      Path path = root.resolve(key).normalize();
      if (!path.startsWith(root)) throw new IOException();
      for (Path cursor=path; cursor!=null && cursor.startsWith(root); cursor=cursor.getParent()) {
        if (Files.isSymbolicLink(cursor)) throw new IOException();
      }
      return path;
    }
    public RetentionObjects.Page list(String prefix, String token) {
      validateInventoryPrefix(prefix);
      if (token != null) validateKey(token);
      try {
        String category=prefix.split("/",3)[1];
        Path start=retainedPath("collect/"+category+"/inventory").getParent();
        if (!Files.exists(start)) return new RetentionObjects.Page(List.of(),null);
        try (var paths=Files.walk(start)) {
          var keys=paths.filter(p->Files.isRegularFile(p,LinkOption.NOFOLLOW_LINKS))
              .map(p->root.relativize(p).toString().replace('\\','/'))
              .filter(k->k.startsWith(prefix) && (token==null || k.compareTo(token)>0))
              .sorted().limit(1001).toList();
          for (String key:keys) retainedPath(key);
          boolean more=keys.size()>1000;
          var page=more?keys.subList(0,1000):keys;
          return new RetentionObjects.Page(page,more?page.getLast():null);
        }
      } catch (IOException e) { throw new CollectorFailure(503,"OBJECT_INVENTORY_FAILED"); }
    }
    public void delete(String key) {
      try { Files.deleteIfExists(retainedPath(key)); }
      catch (IOException e) { throw new CollectorFailure(503,"OBJECT_DELETE_FAILED"); }
    }
    public boolean exists(String key) {
      try { return Files.readAttributes(retainedPath(key),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).isRegularFile(); }
      catch (NoSuchFileException e) { return false; }
      catch (IOException e) { throw new CollectorFailure(503,"OBJECT_HEAD_FAILED"); }
    }
  }
  final class Presigned implements BatchObjectStore {
    private final String template; private final HttpClient http=HttpClient.newHttpClient();
    public Presigned(String template){this.template=template;}
    public Record put(String prefix,byte[] bytes,String contentType){
      validateKey(prefix);
      String url=template.replace("{key}",prefix);
      try {var r=http.send(HttpRequest.newBuilder(URI.create(url)).header("Content-Type",contentType).PUT(HttpRequest.BodyPublishers.ofByteArray(bytes)).build(),HttpResponse.BodyHandlers.discarding());if(r.statusCode()/100!=2)throw new IOException();return new Record(prefix,sha(bytes),bytes.length,contentType);}catch(Exception e){throw new CollectorFailure(503,"OBJECT_STORE_WRITE_FAILED");}
    }
  }
  final class S3Compatible implements BatchObjectStore, RetentionObjects {
    private static final DateTimeFormatter AMZ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private final URI endpoint; private final String bucket, access, secret; private final HttpClient http;
    public S3Compatible(String endpoint, String bucket, String access, String secret) {
      this(endpoint,bucket,access,secret,HttpClient.newHttpClient());
    }
    S3Compatible(String endpoint, String bucket, String access, String secret,HttpClient http) {
      this.http=Objects.requireNonNull(http);
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
    public void delete(String key) {
      validateKey(key);
      try {
        var request=signed("DELETE",objectUri(key),"application/octet-stream","UNSIGNED-PAYLOAD",Instant.now())
            .DELETE().build();
        int status=http.send(request,HttpResponse.BodyHandlers.discarding()).statusCode();
        if (status!=404 && status/100!=2) throw new CollectorFailure(503,status==403?"OBJECT_FORBIDDEN":"OBJECT_DELETE_FAILED");
      } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new CollectorFailure(503,"OBJECT_INTERRUPTED"); }
      catch (CollectorFailure e) { throw e; }
      catch (Exception e) { throw new CollectorFailure(503,"OBJECT_DELETE_FAILED"); }
    }
    public boolean exists(String key) {
      validateKey(key);
      try {
        var request=signed("HEAD",objectUri(key),"application/octet-stream","UNSIGNED-PAYLOAD",Instant.now())
            .method("HEAD",HttpRequest.BodyPublishers.noBody()).build();
        int status=http.send(request,HttpResponse.BodyHandlers.discarding()).statusCode();
        if (status==404) return false;
        if (status/100!=2) throw new CollectorFailure(503,status==403?"OBJECT_FORBIDDEN":"OBJECT_HEAD_FAILED");
        return true;
      } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new CollectorFailure(503,"OBJECT_INTERRUPTED"); }
      catch (CollectorFailure e) { throw e; }
      catch (Exception e) { throw new CollectorFailure(503,"OBJECT_HEAD_FAILED"); }
    }
    public RetentionObjects.Page list(String prefix, String token) {
      validateInventoryPrefix(prefix);
      if (token!=null && token.length()>4096) throw new CollectorFailure(400,"OBJECT_INVENTORY_TOKEN_INVALID");
      var query=new TreeMap<String,String>();
      query.put("list-type","2");query.put("max-keys","1000");query.put("prefix",prefix);
      if(token!=null)query.put("continuation-token",token);
      String parameters=query.entrySet().stream().map(e->encode(e.getKey())+"="+encode(e.getValue()))
          .collect(java.util.stream.Collectors.joining("&"));
      URI uri=endpoint.resolve("/"+encode(bucket)+"?"+parameters);
      try {
        var request=signed("GET",uri,"application/xml","UNSIGNED-PAYLOAD",Instant.now()).GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.limiting(HttpResponse.BodyHandlers.ofByteArray(),2*1024*1024));
        try(var stream=new java.io.ByteArrayInputStream(response.body())) {
          if(response.statusCode()!=200)throw new CollectorFailure(503,response.statusCode()==403?"OBJECT_FORBIDDEN":"OBJECT_INVENTORY_FAILED");
          byte[] xml=stream.readNBytes(2*1024*1024+1);
          if(xml.length>2*1024*1024)throw new IOException();
          var factory=javax.xml.parsers.DocumentBuilderFactory.newInstance();
          factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
          factory.setFeature("http://xml.org/sax/features/external-general-entities",false);
          factory.setFeature("http://xml.org/sax/features/external-parameter-entities",false);
          factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD,"");
          factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
          var doc=factory.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(xml));
          var nodes=doc.getElementsByTagName("Key");var keys=new ArrayList<String>();
          if(nodes.getLength()>1000)throw new IOException();
          for(int i=0;i<nodes.getLength();i++) {
            String key=nodes.item(i).getTextContent();validateKey(key);
            if(!key.startsWith(prefix))throw new IOException();keys.add(key);
          }
          var truncated=doc.getElementsByTagName("IsTruncated");
          if(truncated.getLength()!=1)throw new IOException();
          String next=null;
          if("true".equals(truncated.item(0).getTextContent())) {
            var tokens=doc.getElementsByTagName("NextContinuationToken");
            if(tokens.getLength()!=1)throw new IOException();next=tokens.item(0).getTextContent();
            if(next.isBlank() || next.equals(token) || next.length()>4096)throw new IOException();
          } else if(!"false".equals(truncated.item(0).getTextContent()))throw new IOException();
          return new RetentionObjects.Page(keys,next);
        }
      } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new CollectorFailure(503,"OBJECT_INTERRUPTED"); }
      catch (CollectorFailure e) { throw e; }
      catch (Exception e) { throw new CollectorFailure(503,"OBJECT_INVENTORY_FAILED"); }
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
      String canonicalRequest = method + "\n" + uri.getRawPath() + "\n" + (uri.getRawQuery()==null?"":uri.getRawQuery()) + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;
      String scope = shortDate + "/auto/s3/aws4_request";
      String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hex(sha(canonicalRequest.getBytes(StandardCharsets.UTF_8)));
      byte[] signing = hmac(hmac(hmac(hmac(("AWS4" + secret).getBytes(StandardCharsets.UTF_8), shortDate), "auto"), "s3"), "aws4_request");
      String signature = hex(hmac(signing, stringToSign));
      var builder = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30))
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
