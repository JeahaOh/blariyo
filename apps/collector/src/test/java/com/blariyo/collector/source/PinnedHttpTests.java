package com.blariyo.collector.source;

import static org.junit.jupiter.api.Assertions.*;

import com.blariyo.collector.shared.CollectorFailure;
import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.security.KeyStore;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.net.ssl.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class PinnedHttpTests {
  @TempDir Path directory;
  HttpsServer server;
  SSLContext tls;
  ExecutorService workers;

  @BeforeEach
  void setup() throws Exception {
    Path store = directory.resolve("fixture.p12");
    var process =
        new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "keytool").toString(),
                "-genkeypair",
                "-alias",
                "fixture",
                "-keyalg",
                "RSA",
                "-storetype",
                "PKCS12",
                "-keystore",
                store.toString(),
                "-storepass",
                "fixture-only-passphrase",
                "-keypass",
                "fixture-only-passphrase",
                "-dname",
                "CN=fixture.invalid",
                "-ext",
                "SAN=dns:fixture.invalid",
                "-validity",
                "1")
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .start();
    assertTrue(process.waitFor(20, TimeUnit.SECONDS));
    assertEquals(0, process.exitValue());
    var keys = KeyStore.getInstance("PKCS12");
    try (var in = Files.newInputStream(store)) {
      keys.load(in, "fixture-only-passphrase".toCharArray());
    }
    var keyManager = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
    keyManager.init(keys, "fixture-only-passphrase".toCharArray());
    var trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    trust.init(keys);
    tls = SSLContext.getInstance("TLS");
    tls.init(keyManager.getKeyManagers(), trust.getTrustManagers(), null);
    server = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.setHttpsConfigurator(new HttpsConfigurator(tls));
    workers = Executors.newVirtualThreadPerTaskExecutor();
    server.setExecutor(workers);
    server.createContext(
        "/",
        exchange -> {
          try {
            String path = exchange.getRequestURI().getPath();
            exchange.getResponseHeaders().set("Content-Type", "text/html");
            if (path.equals("/redirect")) {
              exchange.getResponseHeaders().set("Location", "https://other.invalid/");
              exchange.sendResponseHeaders(302, -1);
              return;
            }
            if (path.equals("/encoded"))
              exchange.getResponseHeaders().set("Content-Encoding", "gzip");
            if (path.equals("/slow")) {
              Thread.sleep(12000);
              exchange.sendResponseHeaders(200, 0);
              exchange.getResponseBody().write(1);
              exchange.getResponseBody().flush();
              Thread.sleep(13000);
              return;
            }
            byte[] body = "fixture-body".getBytes();
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
          } catch (Exception ignored) {
          } finally {
            exchange.close();
          }
        });
    server.start();
  }

  @AfterEach
  void close() {
    if (server != null) server.stop(0);
    if (workers != null) workers.shutdownNow();
  }

  PinnedHttp client(AtomicInteger lookups, AtomicReference<InetSocketAddress> target)
      throws Exception {
    InetAddress address = InetAddress.getByName("8.8.8.8");
    return new PinnedHttp(
        host -> {
          lookups.incrementAndGet();
          return new InetAddress[] {address};
        },
        () ->
            new Socket() {
              @Override
              public void connect(SocketAddress endpoint, int timeout) throws IOException {
                target.set((InetSocketAddress) endpoint);
                super.connect(
                    new InetSocketAddress("127.0.0.1", server.getAddress().getPort()), timeout);
              }
            },
        tls);
  }

  @Test
  void pinnedConnectionPreservesTlsHostnameAndNeverFollowsRedirects() throws Exception {
    var lookups = new AtomicInteger();
    var target = new AtomicReference<InetSocketAddress>();
    var client = client(lookups, target);
    var response =
        client.get(URI.create("https://fixture.invalid/detail"), 1024, "Fixture/contact-test");
    assertEquals("fixture-body", new String(response.bytes()));
    assertEquals(1, lookups.get());
    assertEquals("8.8.8.8", target.get().getAddress().getHostAddress());
    assertEquals(443, target.get().getPort());
    assertEquals(
        302,
        client
            .get(URI.create("https://fixture.invalid/redirect"), 1024, "Fixture/contact-test")
            .status());
    assertEquals(2, lookups.get());
    assertEquals(
        "SOURCE_FETCH_FAILED",
        assertThrows(
                CollectorFailure.class,
                () ->
                    client.get(
                        URI.create("https://other.invalid/detail"), 1024, "Fixture/contact-test"))
            .getMessage());
  }

  @Test
  void reboundPrivateAddressNeverOpensASocket() throws Exception {
    var lookups = new AtomicInteger();
    var connections = new AtomicInteger();
    var publicIp = InetAddress.getByName("8.8.8.8");
    var privateIp = InetAddress.getByName("127.0.0.1");
    var client =
        new PinnedHttp(
            host -> new InetAddress[] {lookups.getAndIncrement() == 0 ? publicIp : privateIp},
            () -> {
              connections.incrementAndGet();
              return new Socket();
            },
            tls);
    var uri = URI.create("https://fixture.invalid/detail");
    client.validate(uri);
    assertThrows(CollectorFailure.class, () -> client.get(uri, 1024, "Fixture/contact-test"));
    assertEquals(0, connections.get());
  }

  @Test
  void responseSizeEncodingAndBodyTimeoutAreBounded() throws Exception {
    var client = client(new AtomicInteger(), new AtomicReference<>());
    assertEquals(
        413,
        assertThrows(
                CollectorFailure.class,
                () ->
                    client.get(
                        URI.create("https://fixture.invalid/detail"), 4, "Fixture/contact-test"))
            .status());
    assertEquals(
        415,
        assertThrows(
                CollectorFailure.class,
                () ->
                    client.get(
                        URI.create("https://fixture.invalid/encoded"),
                        1024,
                        "Fixture/contact-test"))
            .status());
    long start = System.nanoTime();
    assertThrows(
        CollectorFailure.class,
        () -> client.get(URI.create("https://fixture.invalid/slow"), 1024, "Fixture/contact-test"));
    assertTrue((System.nanoTime() - start) / 1_000_000_000L < 24);
  }
}
