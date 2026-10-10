package com.blariyo.collector.source;

import com.blariyo.collector.shared.CollectorFailure;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/**
 * HTTP(S) uses a one-use loopback proxy connected to an already validated IP.
 * HTTPS still verifies the origin hostname/TLS certificate. The origin is never re-resolved.
 */
public final class PinnedHttp implements SourceTransport {
  private final java.util.function.Function<String, InetAddress[]> resolver;
  private final java.util.function.Supplier<Socket> socketFactory;
  private final javax.net.ssl.SSLContext tls;
  private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ORIGINAL_SERVER);

  public PinnedHttp() {
    this(PinnedHttp::resolve, Socket::new, null);
  }

  PinnedHttp(
      java.util.function.Function<String, InetAddress[]> resolver,
      java.util.function.Supplier<Socket> socketFactory,
      javax.net.ssl.SSLContext tls) {
    this.resolver = resolver;
    this.socketFactory = socketFactory;
    this.tls = tls;
  }

  private static final ExecutorService DNS =
      new ThreadPoolExecutor(
          0,
          1,
          30,
          TimeUnit.SECONDS,
          new SynchronousQueue<>(),
          Thread.ofPlatform().daemon().name("collector-dns").factory(),
          new ThreadPoolExecutor.AbortPolicy());

  private static InetAddress[] resolve(String host) {
    Future<InetAddress[]> result = null;
    try {
      result = DNS.submit(() -> InetAddress.getAllByName(host));
      return result.get(5, TimeUnit.SECONDS);
    } catch (Exception e) {
      if (result != null) result.cancel(true);
      if (e instanceof InterruptedException) Thread.currentThread().interrupt();
      throw new CollectorFailure(503, "SOURCE_DNS_FAILED").diagnostic("DNS_LOOKUP_FAILED", null, null);
    }
  }

  public void validate(URI uri) {
    requestPort(uri);
    var addresses = resolver.apply(uri.getHost());
    if (addresses.length == 0 || Arrays.stream(addresses).anyMatch(a -> !publicAddress(a)))
      throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED").diagnostic(addresses.length == 0 ? "DNS_EMPTY" : "NON_PUBLIC_IP", uri, null);
  }

  public record Response(
      int status, String contentType, Map<String, List<String>> headers, byte[] bytes) {}

  public static boolean publicAddress(InetAddress address) {
    if (address.isAnyLocalAddress()
        || address.isLoopbackAddress()
        || address.isLinkLocalAddress()
        || address.isSiteLocalAddress()
        || address.isMulticastAddress()) return false;
    byte[] b = address.getAddress();
    int first = b[0] & 255;
    if (b.length == 4) {
      int second = b[1] & 255, third = b[2] & 255;
      return !(first == 0
          || first == 10
          || first == 127
          || first >= 224
          || first == 169 && second == 254
          || first == 172 && second >= 16 && second <= 31
          || first == 192
              && (second == 168
                  || second == 0 && (third == 0 || third == 2)
                  || second == 88 && third == 99)
          || first == 100 && second >= 64 && second <= 127
          || first == 198 && (second == 18 || second == 19 || second == 51 && third == 100)
          || first == 203 && second == 0 && third == 113);
    }
    // Only global unicast; block unique-local, IPv4 mappings and documentation space.
    return (first & 0xe0) == 0x20
        && !(first == 0x3f && (b[1] & 255) == 0xff && (b[2] & 0xf0) == 0)
        && !(first == 0x20 && (b[1] & 255) == 2) // 6to4 can embed a private IPv4 target.
        && !(first == 0x20
            && (b[1] & 255) == 1
            && ((b[2] & 255) < 2 || (b[2] & 255) == 0x0d && (b[3] & 255) == 0xb8));
  }

  public Response get(URI uri, int maximum, String userAgent) {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
    try {
      int port = requestPort(uri);
      boolean secure = uri.getScheme().equals("https");
      InetAddress[] addresses = resolver.apply(uri.getHost());
      if (addresses.length == 0 || Arrays.stream(addresses).anyMatch(a -> !publicAddress(a)))
        throw new CollectorFailure(403, "SOURCE_NOT_ALLOWED").diagnostic(addresses.length == 0 ? "DNS_EMPTY" : "NON_PUBLIC_IP", uri, null);
      try (ServerSocket proxy = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
        proxy.setSoTimeout(5000);
        var sockets = new CopyOnWriteArrayList<Socket>();
        Thread.ofVirtual()
            .start(
                () -> {
                  try {
                    Socket incoming = proxy.accept();
                    sockets.add(incoming);
                    incoming.setSoTimeout(20000);
                    InputStream in = incoming.getInputStream();
                    var buffer = new ByteArrayOutputStream();
                    int last = 0, current;
                    while (buffer.size() < 8192 && (current = in.read()) != -1) {
                      buffer.write(current);
                      last = (last << 8) | current;
                      if (last == 0x0d0a0d0a) break;
                    }
                    String header = buffer.toString(java.nio.charset.StandardCharsets.US_ASCII);
                    String firstLine = secure ? "CONNECT " + uri.getHost() + ":443 HTTP/1.1\r\n"
                        : "GET " + uri.toASCIIString() + " HTTP/1.1\r\n";
                    if (!header.startsWith(firstLine) || !header.endsWith("\r\n\r\n"))
                      throw new IOException();
                    Socket remote = socketFactory.get();
                    sockets.add(remote);
                    remote.connect(new InetSocketAddress(addresses[0], port), 5000);
                    remote.setSoTimeout(20000);
                    if (secure) incoming
                        .getOutputStream()
                        .write(
                            "HTTP/1.1 200 Connection Established\r\n\r\n"
                                .getBytes(java.nio.charset.StandardCharsets.US_ASCII));
                    else {
                      String path = uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
                      if (uri.getRawQuery() != null) path += "?" + uri.getRawQuery();
                      remote.getOutputStream().write(("GET " + path + " HTTP/1.1\r\n"
                          + header.substring(firstLine.length())).getBytes(java.nio.charset.StandardCharsets.US_ASCII));
                    }
                    Thread.ofVirtual().start(() -> copy(in, remote, incoming));
                    copy(remote.getInputStream(), incoming, remote);
                  } catch (Exception ignored) {
                    for (Socket socket : sockets)
                      try {
                        socket.close();
                      } catch (Exception ignoredClose) {
                      }
                  }
                });
        try (HttpClient client =
            HttpClient.newBuilder()
                .sslContext(tls == null ? javax.net.ssl.SSLContext.getDefault() : tls)
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .cookieHandler(cookies)
                .proxy(
                    ProxySelector.of(
                        new InetSocketAddress(proxy.getInetAddress(), proxy.getLocalPort())))
                .build()) {
          var request =
              HttpRequest.newBuilder(uri)
                  .timeout(Duration.ofNanos(Math.max(1, deadline - System.nanoTime())))
                  .header("User-Agent", userAgent)
                  .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                  .header("Accept-Language", "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7")
                  .header("Accept-Encoding", "identity")
                  .header("Referer", uri.getScheme() + "://" + uri.getHost() + "/")
                  .GET()
                  .build();
          var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
          try (InputStream input = response.body()) {
            if (!response
                .headers()
                .firstValue("content-encoding")
                .orElse("identity")
                .equalsIgnoreCase("identity"))
              throw new CollectorFailure(415, "SOURCE_ENCODING_UNSUPPORTED").diagnostic("ENCODING_UNSUPPORTED", uri, response.statusCode());
            if (response.headers().firstValueAsLong("content-length").orElse(0) > maximum)
              throw new CollectorFailure(413, "SOURCE_TOO_LARGE").diagnostic("BODY_TOO_LARGE", uri, response.statusCode());
            try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
              var read = executor.submit(() -> input.readNBytes(maximum + 1));
              byte[] bytes;
              try {
                bytes = read.get(Math.max(1, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
              } catch (TimeoutException | InterruptedException e) {
                input.close();
                read.cancel(true);
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                throw e;
              }
              if (bytes.length > maximum) throw new CollectorFailure(413, "SOURCE_TOO_LARGE").diagnostic("BODY_TOO_LARGE", uri, response.statusCode());
              return new Response(
                  response.statusCode(),
                  response.headers().firstValue("content-type").orElse(""),
                  response.headers().map(),
                  bytes);
            }
          }
        } finally {
          for (Socket socket : sockets)
            try {
              socket.close();
            } catch (Exception ignored) {
            }
        }
      }
    } catch (CollectorFailure e) {
      throw e.diagnostic(null, uri, null);
    } catch (Exception e) {
      String reason = e instanceof javax.net.ssl.SSLException ? "TLS_ERROR"
          : e instanceof java.net.http.HttpTimeoutException || e instanceof TimeoutException || e instanceof SocketTimeoutException ? "TIMEOUT"
          : e instanceof InterruptedException ? "NETWORK_INTERRUPTED" : "CONNECTION_ERROR";
      throw new CollectorFailure(503, "SOURCE_FETCH_FAILED").diagnostic(reason, uri, null);
    }
  }

  private static int requestPort(URI uri) {
    int port = "https".equals(uri.getScheme()) ? 443 : "http".equals(uri.getScheme()) ? 80 : -1;
    String reason = port == -1 ? "SCHEME_NOT_ALLOWED" : uri.getHost() == null ? "INVALID_URL"
        : uri.getUserInfo() != null ? "URL_CREDENTIALS_NOT_ALLOWED" : uri.getFragment() != null ? "URL_FRAGMENT_NOT_ALLOWED"
        : uri.getPort() != -1 && uri.getPort() != port ? "PORT_NOT_ALLOWED" : null;
    if(reason != null)throw new CollectorFailure(403,"SOURCE_NOT_ALLOWED").diagnostic(reason,uri,null);
    return port;
  }

  private static void copy(InputStream input, Socket target, Socket source) {
    try {
      input.transferTo(target.getOutputStream());
    } catch (Exception ignored) {
    } finally {
      try {
        target.close();
        source.close();
      } catch (Exception ignored) {
      }
    }
  }
}
