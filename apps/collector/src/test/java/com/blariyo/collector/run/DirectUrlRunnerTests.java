package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.PinnedHttp;
import com.blariyo.collector.source.SourceRegistry;
import com.blariyo.collector.source.SourceTransport;
import com.blariyo.collector.storage.BatchObjectStore;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DirectUrlRunnerTests {
  @Test void dryRunParsesDetailOnlyTheqooWithoutStoreWrites() {
    var transport = transport();
    var store = mock(BatchStore.class);
    var objects = mock(BatchObjectStore.class);
    var report = new DirectUrlRunner(transport, store, objects, ignored -> {})
        .run(source(), new DirectUrlRunner.Options("theqoo", "https://theqoo.net/hot/1234567890", 10000, false));
    assertEquals("COMPLETED", report.state(), report.toString());
    assertEquals(1, report.fetched());
    verifyNoInteractions(store, objects);
  }

  @Test void writeDbStoresRawMediaAndReportForManualUrl() {
    var store = mock(BatchStore.class);
    var objects = mock(BatchObjectStore.class);
    UUID run = UUID.randomUUID(), item = UUID.randomUUID();
    when(store.begin(eq("theqoo"), eq("manual"), eq("WRITE_DB"), eq(1), eq(1), eq(10000L), isNull())).thenReturn(run);
    when(store.item(eq(run), eq("theqoo"), eq("1234567890"), eq("https://theqoo.net/hot/1234567890"), eq("FETCHING"),
        anyString(), contains("fixture body"), contains("file.pdf"), contains("x.com/fixture/status/123"), isNull())).thenReturn(item);
    when(objects.put(anyString(), any(), anyString())).thenAnswer(invocation ->
        new BatchObjectStore.Record(invocation.getArgument(0), new byte[32], ((byte[]) invocation.getArgument(1)).length, invocation.getArgument(2)));

    var report = new DirectUrlRunner(transport(), store, objects, ignored -> {})
        .run(source(), new DirectUrlRunner.Options("theqoo", "https://theqoo.net/hot/1234567890", 10000, true));

    assertEquals("COMPLETED", report.state(), report.toString());
    assertEquals(1, report.fetched());
    verify(objects).put(contains("collect/raw/"), any(), eq("text/html"));
    verify(store).raw(eq(item), contains("collect/raw/"));
    verify(store).media(eq(item), eq(1), eq("IMAGE"), eq("https://img.theqoo.net/one.png"), contains("collect/media/"), any(), eq("image/png"), eq(4L));
    verify(store).media(eq(item), eq(2), eq("FILE"), eq("https://img.theqoo.net/file.pdf"), contains("collect/media/"), any(), eq("application/pdf"), eq(4L));
    verify(store).completeItem(eq(item));
    verify(objects).put(contains("collect/report/"), any(), eq("application/jsonl"));
    verify(store).finish(eq(run), eq("COMPLETED"), anyMap(), contains("collect/report/"));
  }

  private static SourceRegistry.Source source() {
    return new SourceRegistry(Json.tree(Map.of("theqoo", Map.ofEntries(
        Map.entry("host", "theqoo.net"),
        Map.entry("approved", true),
        Map.entry("blockedReason", ""),
        Map.entry("parser", "THEQOO"),
        Map.entry("pathPrefixes", List.of("/hot/")),
        Map.entry("userAgent", "fixture contact-test"),
        Map.entry("imageOrigins", Map.of("https://img.theqoo.net", List.of("/"))),
        Map.entry("charts", Map.of()),
        Map.entry("chartVerified", false),
        Map.entry("batchApproved", false))))).key("theqoo");
  }

  private static SourceTransport transport() {
    return new SourceTransport() {
      public void validate(URI uri) {}
      public PinnedHttp.Response get(URI uri, int maximum, String userAgent) {
        if (uri.getHost().equals("img.theqoo.net"))
          return new PinnedHttp.Response(200, uri.getPath().endsWith(".pdf") ? "application/pdf" : "image/png", Map.of(), new byte[] {1, 2, 3, 4});
        String html = "<html><head><meta property='og:title' content='fixture title'></head><body>"
            + "<article itemprop='articleBody'>"
            + "<p>fixture body https://x.com/fixture/status/123</p>"
            + "<img src='https://img.theqoo.net/one.png'>"
            + "<a href='https://img.theqoo.net/file.pdf'>attachment</a>"
            + "<time datetime='" + Instant.now() + "'></time>"
            + "</article></body></html>";
        return new PinnedHttp.Response(200, "text/html", Map.of(), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      }
    };
  }
}
