package com.blariyo.collector.discord;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.run.CandidateIntake;
import com.blariyo.collector.shared.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DiscordIntakeTests {
  @TempDir Path directory;
  @Test void confirmationResolutionDoesNotWriteAndCreateRechecksPolicy() throws Exception {
    Path path=directory.resolve("sources.json");
    var source=new HashMap<String,Object>(Map.of("host","arca.live","approved",true,"parser","ARCALIVE",
        "pathPrefixes",List.of("/b/"),"userAgent","fixture contact-fixture.invalid"));
    Files.write(path,Json.bytes(Map.of("arcalive",source)));
    var core=mock(CoreClient.class);
    var intake=new CandidateIntake(core,path.toString());
    assertEquals("arcalive",intake.resolve("https://arca.live/b/live/123?p=2").key());
    verifyNoInteractions(core);
    when(core.collectorId()).thenReturn("fixture");
    when(core.post(anyString(),anyString(),any())).thenReturn(Json.tree(Map.of("candidateId",1)));
    intake.create("confirmed","https://arca.live/b/live/123?p=2");
    verify(core).post(eq("/candidates"),eq("confirmed"),argThat(body->body.path("originUrl").asText().equals("https://arca.live/b/live/123")));
    clearInvocations(core);
    source.put("approved",false);Files.write(path,Json.bytes(Map.of("arcalive",source)));
    assertThrows(CollectorFailure.class,()->intake.create("stale-confirmation","https://arca.live/b/live/123"));
    verifyNoInteractions(core);
  }
  @Test void commandDefinitionMatchesGatewaySubcommands() {
    var command=DiscordCommands.collect();
    assertEquals("collect",command.getName());
    assertEquals(List.of("url","status"),command.getSubcommands().stream().map(c->c.getName()).toList());
    assertTrue(command.getSubcommands().getFirst().getOptions().getFirst().isRequired());
  }
}
