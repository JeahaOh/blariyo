package com.blariyo.collector.storage;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.shared.CollectorFailure;
import java.io.IOException;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

class RetentionObjectsTests {
  @TempDir Path root;
  @Test void credentialsNeverFallBackToUploadOrBackupAndKeysCannotEscapeCollect() throws Exception {
    assertThrows(CollectorFailure.class,()->RetentionObjects.fromEnvironment(Map.of("COLLECTOR_OBJECT_STORE_DIRECTORY",root.toString())));
    var store=new BatchObjectStore.Local(root.toString());
    Path protectedFile=root.resolve("private/canary");Files.createDirectories(protectedFile.getParent());Files.writeString(protectedFile,"keep");
    for(String key:List.of("private/canary","collect/raw/../../private/canary","collect/raw//bad")) {
      assertThrows(CollectorFailure.class,()->store.delete(key));
    }
    Path outside=Files.createDirectory(root.resolve("outside"));Files.writeString(outside.resolve("canary"),"keep");
    Files.createDirectories(root.resolve("collect/raw"));Files.createSymbolicLink(root.resolve("collect/raw/link"),outside);
    assertThrows(CollectorFailure.class,()->store.delete("collect/raw/link/canary"));
    assertEquals("keep",Files.readString(outside.resolve("canary")));assertEquals("keep",Files.readString(protectedFile));
  }
  @Test void localInventoryIsPagedAndExactDeleteHasIndependentReadback() {
    var store=new BatchObjectStore.Local(root.toString());
    for(int i=0;i<1002;i++)store.put("collect/raw/"+String.format("%04d",i),new byte[]{1},"text/plain");
    var first=store.list("collect/raw/",null);assertEquals(1000,first.keys().size());assertNotNull(first.nextToken());
    var last=store.list("collect/raw/",first.nextToken());assertEquals(2,last.keys().size());assertNull(last.nextToken());
    String key=first.keys().getFirst();assertTrue(store.exists(key));store.delete(key);assertFalse(store.exists(key));store.delete(key);
    assertTrue(store.exists(last.keys().getFirst()));
  }
  @Test void s3Distinguishes404From403AndTimeoutWithoutCallingContentKeys() throws Exception {
    var http=mock(HttpClient.class);
    @SuppressWarnings("unchecked") HttpResponse<Void> response=mock(HttpResponse.class);
    when(http.send(any(),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<Void>>any())).thenReturn(response);
    var store=new BatchObjectStore.S3Compatible("https://fixture.invalid","collect-fixture","fixture-access","fixture-secret",http);
    when(response.statusCode()).thenReturn(404);store.delete("collect/raw/a");assertFalse(store.exists("collect/raw/a"));
    when(response.statusCode()).thenReturn(403);
    assertEquals("OBJECT_FORBIDDEN",assertThrows(CollectorFailure.class,()->store.delete("collect/raw/a")).getMessage());
    assertEquals("OBJECT_FORBIDDEN",assertThrows(CollectorFailure.class,()->store.exists("collect/raw/a")).getMessage());
    reset(http);when(http.send(any(),any())).thenThrow(new IOException("synthetic timeout"));
    assertEquals("OBJECT_HEAD_FAILED",assertThrows(CollectorFailure.class,()->store.exists("collect/raw/a")).getMessage());
    reset(http);assertThrows(CollectorFailure.class,()->store.delete("private/protected"));verifyNoInteractions(http);
  }
  @Test void s3PaginationSignsTheExactEncodedQueryAndRejectsOutOfScopeResponse() throws Exception {
    var http=mock(HttpClient.class);
    @SuppressWarnings("unchecked") HttpResponse<byte[]> response=mock(HttpResponse.class);
    when(http.send(any(),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<byte[]>>any())).thenReturn(response);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn("<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>collect/raw/a</Key></Contents><NextContinuationToken>next+token/</NextContinuationToken></ListBucketResult>".getBytes(StandardCharsets.UTF_8));
    var store=new BatchObjectStore.S3Compatible("https://fixture.invalid","collect-fixture","fixture-access","fixture-secret",http);
    var page=store.list("collect/raw/","a+b/");assertEquals(List.of("collect/raw/a"),page.keys());assertEquals("next+token/",page.nextToken());
    var request=ArgumentCaptor.forClass(HttpRequest.class);verify(http).send(request.capture(),any());
    assertEquals("continuation-token=a%2Bb%2F&list-type=2&max-keys=1000&prefix=collect%2Fraw%2F",request.getValue().uri().getRawQuery());
    assertTrue(request.getValue().headers().firstValue("Authorization").orElseThrow().contains("SignedHeaders="));
    when(response.body()).thenReturn("<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>private/canary</Key></Contents></ListBucketResult>".getBytes(StandardCharsets.UTF_8));
    assertThrows(CollectorFailure.class,()->store.list("collect/raw/",null));
    when(response.body()).thenReturn("<!DOCTYPE test SYSTEM 'file:///etc/passwd'><ListBucketResult/>".getBytes(StandardCharsets.UTF_8));
    assertThrows(CollectorFailure.class,()->store.list("collect/raw/",null));
  }
}
