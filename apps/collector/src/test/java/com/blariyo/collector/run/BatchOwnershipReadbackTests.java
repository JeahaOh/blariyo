package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.CollectorFailure;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.*;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class BatchOwnershipReadbackTests {
  private HikariDataSource database() throws Exception {
    String url=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(url!=null&&!url.isBlank(),"COLLECTOR_READBACK_DATABASE_URL not set");
    var config=new HikariConfig();config.setJdbcUrl(url);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    config.setMaximumPoolSize(4);
    MigrationMain.migrate(url,config.getUsername(),config.getPassword());
    return new HikariDataSource(config);
  }
  private static UUID begin(BatchStore store,String source){return store.begin(source,"test","WRITE_DB",1,1,10000,null);}
  private static UUID claim(BatchStore store,UUID run,String source){
    return store.item(run,source,"1","https://fixture.invalid/"+source+"/1","FETCHING","fixture","[{\"type\":\"TEXT\",\"text\":\"body\"}]","[]",null);
  }
  private static void finish(BatchStore store,UUID run){store.finish(run,"COMPLETED",Map.of("items",1,"fetched",1),"collect/report/"+run+".jsonl",BatchStore.sha("fixture report"));}
  private static long number(Connection c,String query) throws SQLException {
    try(var s=c.createStatement();var r=s.executeQuery(query)){assertTrue(r.next());return r.getLong(1);}
  }
  private static void rejected(Connection c,String query) {
    assertThrows(SQLException.class,()->{try(var s=c.createStatement()){s.execute(query);}});
  }
  @Test void dbEnforcesLeaseVersionsImmutableSnapshotsAndAtomicReports() throws Exception {
    try(var ds=database()) {
      var store=new BatchStore(ds);String source="fence-"+UUID.randomUUID();
      assertThrows(CollectorFailure.class,()->begin(store,source));
      try(var lease=store.lockSource(source)) {
        UUID run=begin(store,source),item=claim(store,run,source);
        try(var owned=store.connection();var outsider=ds.getConnection()) {
          // Same-owner connection is reused and no transaction is held across external I/O.
          assertTrue(owned.getAutoCommit());
          rejected(outsider,"UPDATE collect.batch_item SET title='stale',version=version+1 WHERE id='"+item+"'");
          rejected(owned,"UPDATE collect.batch_item SET title='bad version' WHERE id='"+item+"'");
          rejected(owned,"UPDATE collect.batch_item SET state='DISCOVERED',version=version+1 WHERE id='"+item+"'");
          rejected(owned,"UPDATE collect.batch_item SET state='FETCHED',fetched_at=now(),version=version+1 WHERE id='"+item+"'");
          rejected(owned,"UPDATE collect.batch_run SET state='COMPLETED',finished_at=now(),version=version+1 WHERE id='"+run+"'");
          rejected(owned,"UPDATE collect.batch_run SET owner_backend_pid=0,version=version+1 WHERE id='"+run+"'");
        }
        store.raw(item,"collect/raw/"+run+"/1.html");store.completeItem(item);
        try(var owned=store.connection()) {
          rejected(owned,"UPDATE collect.batch_item SET title='changed',version=version+1 WHERE id='"+item+"'");
          rejected(owned,"INSERT INTO collect.batch_media(id,item_id,position,kind) VALUES(gen_random_uuid(),'"+item+"',1,'IMAGE')");
        }
        assertThrows(CollectorFailure.class,()->store.finish(run,"INVALID",Map.of("items",1),"collect/report/"+run+".jsonl",BatchStore.sha("fixture")));
        try(var c=ds.getConnection()) {
          assertEquals(0,number(c,"SELECT count(*) FROM collect.batch_report WHERE run_id='"+run+"'"));
          assertEquals(0,number(c,"SELECT count(*) FROM collect.batch_checkpoint WHERE run_id='"+run+"'"));
        }
        finish(store,run);
        try(var owned=store.connection()) {
          assertTrue(owned.getAutoCommit());
          assertEquals(1,number(owned,"SELECT count(*) FROM collect.batch_report r JOIN collect.batch_checkpoint c USING(run_id) WHERE run_id='"+run+"' AND octet_length(r.sha256)=32 AND r.jsonl_count=1 AND c.item_count=1"));
          rejected(owned,"UPDATE collect.batch_run SET state='RUNNING',version=version+1 WHERE id='"+run+"'");
          rejected(owned,"UPDATE collect.batch_checkpoint SET version=version+1 WHERE run_id='"+run+"'");
        }
      }
      // Manual intake can queue without taking a long-lived fetch lease.
      UUID queued=store.queueManual(source,"2","https://fixture.invalid/"+source+"/2");
      try(var c=ds.getConnection()) { assertEquals(1,number(c,"SELECT count(*) FROM collect.batch_queue WHERE id='"+queued+"' AND state='QUEUED'")); }
    }
  }
  @Test void terminatedBackendCannotReconnectAndOverwriteTheNewOwner() throws Exception {
    try(var ds=database()) {
      var oldStore=new BatchStore(ds);var newStore=new BatchStore(ds);String source="lost-"+UUID.randomUUID();
      try(var oldLease=oldStore.lockSource(source)) {
        UUID oldRun=begin(oldStore,source),item=claim(oldStore,oldRun,source);
        long pid;
        try(var c=oldStore.connection()){pid=number(c,"SELECT pg_backend_pid()");}
        try(var killer=ds.getConnection();var s=killer.prepareStatement("SELECT pg_terminate_backend(?,5000)")) {
          s.setInt(1,(int)pid);try(var r=s.executeQuery()){assertTrue(r.next());assertTrue(r.getBoolean(1));}
        }
        assertThrows(CollectorFailure.class,()->oldStore.raw(item,"collect/raw/stale.html"));
        try(var newLease=newStore.lockSource(source)) {
          try(var owned=newStore.connection()) {
            rejected(owned,"UPDATE collect.batch_run SET version=version+1 WHERE id='"+oldRun+"'");
          }
          UUID newRun=begin(newStore,source);
          assertEquals(item,claim(newStore,newRun,source));
          assertThrows(CollectorFailure.class,()->oldStore.raw(item,"collect/raw/stale-after-restart.html"));
          newStore.raw(item,"collect/raw/"+newRun+"/1.html");newStore.completeItem(item);finish(newStore,newRun);
          try(var c=ds.getConnection()) {
            assertEquals(1,number(c,"SELECT count(*) FROM collect.batch_run WHERE id='"+oldRun+"' AND state='FAILED' AND checkpoint->>'reason'='BATCH_OWNER_LOST'"));
            assertEquals(1,number(c,"SELECT count(*) FROM collect.batch_item WHERE id='"+item+"' AND run_id='"+newRun+"' AND state='FETCHED' AND raw_object_key='collect/raw/"+newRun+"/1.html'"));
          }
        }
      }
    }
  }
}
