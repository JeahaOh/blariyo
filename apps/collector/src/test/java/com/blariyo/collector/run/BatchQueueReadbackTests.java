package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.discord.BatchDiscordIntake;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class BatchQueueReadbackTests {
  @TempDir Path root;
  final String source="queue-"+UUID.randomUUID();
  final String postKey=Long.toString(System.nanoTime());
  final String url="https://arca.live/b/live/"+postKey;
  HikariDataSource db;BatchStore store;BatchQueueStore queue;
  @BeforeEach void start() throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank());
    var config=new HikariConfig();config.setJdbcUrl(jdbc);config.setMaximumPoolSize(8);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());db=new HikariDataSource(config);store=new BatchStore(db);queue=new BatchQueueStore(store);
  }
  @AfterEach void close(){if(db!=null)db.close();}
  SourceRegistry registry(boolean approved) {return new SourceRegistry(Json.tree(Map.of(source,Map.of("host","arca.live","approved",approved,"parser","ARCALIVE","pathPrefixes",List.of("/"),"userAgent","fixture contact.invalid"))));}
  BatchDiscordIntake intake(Supplier<SourceRegistry> sources){return new BatchDiscordIntake(queue,sources,v->HexFormat.of().formatHex(BatchStore.sha(v)));}
  static String body(){return "<title>Queue fixture</title><div class='article-view'><div class='article-content'><p>Whole original body</p><img src='https://arca.live/image.png'><a href='https://arca.live/file.pdf'>attached file</a><a href='https://x.com/example/status/12345'>SNS source</a></div></div>";}
  static PinnedHttp.Response html(String text){return new PinnedHttp.Response(200,"text/html",Map.of(),text.getBytes(StandardCharsets.UTF_8));}
  static SourceTransport network(Function<URI,PinnedHttp.Response> get){return new SourceTransport(){public void validate(URI u){}public PinnedHttp.Response get(URI u,int max,String agent){return get.apply(u);}};}
  static PinnedHttp.Response good(URI u){if(u.getPath().endsWith(".png"))return new PinnedHttp.Response(200,"image/png",Map.of(),Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="));if(u.getPath().endsWith(".pdf"))return new PinnedHttp.Response(200,"application/pdf",Map.of(),"%PDF-1.4 fixture".getBytes(StandardCharsets.UTF_8));return html(body());}
  BatchQueueWorker worker(SourceTransport transport){return new BatchQueueWorker(store,()->registry(true),transport,new BatchObjectStore.Local(root.toString()),x->{});}
  String scalar(String sql)throws Exception{try(var c=db.getConnection();var q=c.createStatement();var r=q.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}}
  void sql(String sql)throws Exception{try(var c=db.getConnection();var q=c.createStatement()){q.execute(sql);}}
  void awaitReady(UUID id)throws Exception {
    for(;;){long milliseconds=Long.parseLong(scalar("SELECT greatest(0,ceil(extract(epoch from(next_attempt_at-clock_timestamp()))*1000))::bigint FROM collect.batch_queue WHERE id='"+id+"'"));
      if(milliseconds==0)return;Thread.sleep(Math.min(60000,milliseconds+10));}
  }
  UUID enqueue(){return queue.enqueue(source,postKey,url);}
  @Test void concurrentConfirmationIsAtomicAndReplayReturnsSameRequest() throws Exception {
    var intake=intake(()->registry(true));var confirmation=intake.prepare("interaction","actor","channel",url+"?p=2");
    assertEquals("0",scalar("SELECT count(*) FROM collect.batch_queue WHERE source_key='"+source+"'"));
    assertEquals("0",scalar("SELECT count(*) FROM collect.batch_run WHERE source_key='"+source+"'"));
    assertEquals(confirmation.id(),intake.prepare("interaction","actor","channel",url).id());
    assertEquals("LOCAL_FORBIDDEN",assertThrows(CollectorFailure.class,()->intake.confirm(confirmation.id(),"wrong","channel")).getMessage());
    try(var threads=Executors.newFixedThreadPool(4)) {
      var tasks=new ArrayList<Future<UUID>>();for(int i=0;i<12;i++)tasks.add(threads.submit(()->intake.confirm(confirmation.id(),"actor","channel")));
      var ids=new HashSet<UUID>();for(var f:tasks)ids.add(f.get(10,TimeUnit.SECONDS));assertEquals(1,ids.size());
      assertEquals(ids.iterator().next(),intake.confirm(confirmation.id(),"actor","channel"));
      assertEquals(ids.iterator().next(),enqueue());
    }
    assertEquals("1",scalar("SELECT count(*) FROM collect.batch_queue WHERE source_key='"+source+"'"));
    assertEquals("COMPLETED",worker(network(BatchQueueReadbackTests::good)).once(source).outcome());
  }
  @Test void receiptFailureRollsBackEnqueueAndSameConfirmationCanRetry() throws Exception {
    var intake=intake(()->registry(true));var c=intake.prepare("atomic","actor","channel",url);
    String function="queue_fault_"+UUID.randomUUID().toString().replace("-", "");
    sql("CREATE FUNCTION collect."+function+"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.source_key='"+source+"' THEN RAISE EXCEPTION 'INJECTED_RECEIPT_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER "+function+" BEFORE UPDATE ON collect.batch_confirmation FOR EACH ROW EXECUTE FUNCTION collect."+function+"()");
    try {
      assertThrows(CollectorFailure.class,()->intake.confirm(c.id(),"actor","channel"));
      assertEquals("0",scalar("SELECT count(*) FROM collect.batch_queue WHERE source_key='"+source+"'"));
      assertNull(scalar("SELECT request_id FROM collect.batch_confirmation WHERE id='"+c.id()+"'"));
    }finally{sql("DROP TRIGGER "+function+" ON collect.batch_confirmation; DROP FUNCTION collect."+function+"()");}
    UUID id=intake.confirm(c.id(),"actor","channel");assertEquals(id,intake.confirm(c.id(),"actor","channel"));
    var stopped=new BatchQueueWorker(store,()->registry(false),network(u->{throw new AssertionError("policy revoked before worker");}),new BatchObjectStore.Local(root.toString()),x->{}).once(source);
    assertEquals("BLOCKED",stopped.outcome());
    assertEquals("SOURCE_NOT_ALLOWED",scalar("SELECT error_code FROM collect.batch_queue WHERE id='"+id+"'"));
  }
  @Test void expiresAndPolicyRevocationDoNotQueue() throws Exception {
    var active=new AtomicBoolean(true);var intake=intake(()->registry(active.get()));
    var c=intake.prepare("revoked","actor","channel",url);active.set(false);
    assertThrows(CollectorFailure.class,()->intake.confirm(c.id(),"actor","channel"));
    assertEquals("0",scalar("SELECT count(*) FROM collect.batch_queue WHERE source_key='"+source+"'"));
    try(var conn=db.getConnection();var q=conn.prepareStatement("INSERT INTO collect.batch_confirmation(id,trigger_hmac,actor_hmac,channel_hmac,source_key,source_post_key,canonical_url,expires_at) VALUES(?,?,?,?,?,?,?,now()-interval '1 minute')")){
      UUID id=UUID.randomUUID();String hash="a".repeat(64);q.setObject(1,id);q.setString(2,HexFormat.of().formatHex(BatchStore.sha(id.toString())));q.setString(3,hash);q.setString(4,hash);q.setString(5,source);q.setString(6,postKey);q.setString(7,url);q.executeUpdate();
      assertEquals("CONFIRMATION_EXPIRED",assertThrows(CollectorFailure.class,()->queue.confirm(id,hash,hash)).getMessage());
    }
  }
  @Test void queueStoresWholeBodyImageFileSnsAndReportsAndDuplicateDoesNotFetch() throws Exception {
    UUID request=enqueue();var result=worker(network(BatchQueueReadbackTests::good)).once(source);assertEquals("COMPLETED",result.outcome());assertEquals(request,result.requestId());
    assertEquals("COMPLETED",scalar("SELECT state FROM collect.batch_queue WHERE id='"+request+"'"));
    assertEquals("FETCHED",scalar("SELECT state FROM collect.batch_item WHERE run_id='"+result.runId()+"'"));
    assertTrue(scalar("SELECT body_blocks::text FROM collect.batch_item WHERE run_id='"+result.runId()+"'").contains("Whole original body"));
    assertTrue(scalar("SELECT sns_links::text FROM collect.batch_item WHERE run_id='"+result.runId()+"'").contains("x.com/example/status/12345"));
    assertEquals("2",scalar("SELECT count(*) FROM collect.batch_media WHERE item_id IN (SELECT id FROM collect.batch_item WHERE run_id='"+result.runId()+"')"));
    try(var c=db.getConnection();var q=c.createStatement();var r=q.executeQuery("SELECT object_key,sha256,byte_size FROM collect.batch_media WHERE item_id IN (SELECT id FROM collect.batch_item WHERE run_id='"+result.runId()+"')")){
      while(r.next()){byte[] bytes=Files.readAllBytes(root.resolve(r.getString(1)));assertArrayEquals(r.getBytes(2),java.security.MessageDigest.getInstance("SHA-256").digest(bytes));assertEquals(r.getLong(3),bytes.length);}
    }
    assertTrue(Files.readString(root.resolve("collect/report/"+result.runId()+".jsonl")).contains("COMPLETED"));
    UUID second=enqueue();assertNotEquals(request,second);
    assertEquals("COMPLETED",worker(network(u->{throw new AssertionError("duplicate fetch");})).once(source).outcome());
    assertEquals("IDLE",worker(network(BatchQueueReadbackTests::good)).once(source).outcome());
  }
  @Test void activeSourceIsSkippedBySecondPcAndTerminalRowsCannotBeRewritten() throws Exception {
    UUID request=enqueue();var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
    try(var threads=Executors.newSingleThreadExecutor()) {
      var running=threads.submit(()->worker(network(u->{entered.countDown();try{assertTrue(release.await(10,TimeUnit.SECONDS));}catch(InterruptedException e){throw new AssertionError(e);}return good(u);})).once(source));
      assertTrue(entered.await(10,TimeUnit.SECONDS));
      assertEquals("IDLE",worker(network(u->{throw new AssertionError("second owner fetched");})).once(source).outcome());
      release.countDown();assertEquals("COMPLETED",running.get(10,TimeUnit.SECONDS).outcome());
    }finally{release.countDown();}
    assertThrows(SQLException.class,()->sql("UPDATE collect.batch_queue SET state='QUEUED',version=version+1 WHERE id='"+request+"'"));
  }
  @Test void lostOwnerRetriesWithBackoffAndCompletedRunOnlyReconciles() throws Exception {
    UUID request=enqueue();UUID run;
    try(var lease=store.lockSource(source)) {
      queue.claim(queue.next(source));run=store.begin(source,"discord","WRITE_DB",1,1,10000,null);queue.attach(request,run);
    }
    assertEquals("RECOVERED",worker(network(u->{throw new AssertionError("recovery must not fetch");})).once(source).outcome());
    assertEquals("FAILED",scalar("SELECT state FROM collect.batch_run WHERE id='"+run+"'"));
    assertEquals("QUEUED",scalar("SELECT state FROM collect.batch_queue WHERE id='"+request+"'"));
    assertEquals("t",scalar("SELECT next_attempt_at>now()+interval '25 seconds' FROM collect.batch_queue WHERE id='"+request+"'"));
    assertEquals("IDLE",worker(network(u->{throw new AssertionError("backoff");})).once(source).outcome());
    awaitReady(request);
    try(var lease=store.lockSource(source)) {
      var claimed=queue.claim(queue.next(source));
      var completed=new DirectUrlRunner(network(BatchQueueReadbackTests::good),store,new BatchObjectStore.Local(root.toString()),x->{})
          .runQueued(registry(true).key(source),new DirectUrlRunner.Options(source,url,10000,true),id->queue.attach(request,id));
      assertNotEquals(run,completed.runId());assertEquals(2,claimed.attempts());
      // Simulate loss after run commit, before request result commit.
    }
    assertEquals("RECOVERED",worker(network(u->{throw new AssertionError("committed run fetched twice");})).once(source).outcome());
    assertEquals("COMPLETED",scalar("SELECT state FROM collect.batch_queue WHERE id='"+request+"'"));
    assertEquals("2",scalar("SELECT attempts FROM collect.batch_queue WHERE id='"+request+"'"));
  }
  @Test void blockedSiteStopsOtherRequestsAndNoLockOrWrongVersionCannotClaim() throws Exception {
    UUID id=enqueue();var pending=queue.next(source);assertThrows(CollectorFailure.class,()->queue.claim(pending));
    assertEquals("BLOCKED",worker(network(u->new PinnedHttp.Response(403,"text/html",Map.of(),new byte[0]))).once(source).outcome());
    assertEquals("1",scalar("SELECT attempts FROM collect.batch_queue WHERE id='"+id+"'"));
    queue.enqueue(source,postKey+"1",url+"1");
    assertEquals("IDLE",worker(network(u->{throw new AssertionError("blocked site continued");})).once(source).outcome());
    try(var lease=store.lockSource(source)) {
      var next=queue.next(source);queue.claim(next);assertThrows(CollectorFailure.class,()->queue.claim(next));queue.settle(next.id());
    }
  }
  @Test void interruptedRequestWithoutRunHasBoundedAttempts() throws Exception {
    UUID id=enqueue();
    for(int attempt=1;attempt<=3;attempt++) {
      try(var lease=store.lockSource(source)){var request=queue.claim(queue.next(source));assertEquals(attempt,request.attempts());queue.settle(id);}
      assertEquals(attempt<3?"QUEUED":"FAILED",scalar("SELECT state FROM collect.batch_queue WHERE id='"+id+"'"));
      if(attempt<3)awaitReady(id);
    }
    assertEquals("IDLE",worker(network(u->{throw new AssertionError("attempt limit");})).once(source).outcome());
  }
}
