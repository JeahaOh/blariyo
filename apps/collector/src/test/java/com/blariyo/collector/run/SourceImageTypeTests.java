package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class SourceImageTypeTests {
  @Test void observedJpegWithPngHeaderUsesBytesWithoutRewritingOriginal(){
    byte[] bytes=HexFormat.of().parseHex("ffd8ffe000104a464946000101");byte[] original=bytes.clone();
    assertEquals("image/jpeg",SourceImageType.detect(bytes,"image/png"));
    assertArrayEquals(original,bytes);
  }
  @Test void knownSignaturesOverrideHeadersAndUnknownHeadersRemainAdvisory(){
    assertEquals("image/png",SourceImageType.detect(HexFormat.of().parseHex("89504e470d0a1a0a"),"text/plain"));
    assertEquals("image/gif",SourceImageType.detect("GIF89a".getBytes(StandardCharsets.US_ASCII),"image/jpeg"));
    assertEquals("image/webp",SourceImageType.detect("RIFF1234WEBP".getBytes(StandardCharsets.US_ASCII),"image/png"));
    assertEquals("image/avif",SourceImageType.detect("0000ftypavif".getBytes(StandardCharsets.US_ASCII),"application/octet-stream"));
    assertEquals("image/png",SourceImageType.detect(new byte[0],"IMAGE/PNG; charset=binary"));
    assertEquals("",SourceImageType.detect(new byte[0],null));
  }
}
