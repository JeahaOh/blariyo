package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.blariyo.collector.ops.MigrationMain;
import com.blariyo.collector.shared.CollectorFailure;
import com.zaxxer.hikari.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;

class DirectRequestBudgetTests {
  @Test void missingStoreOrInvalidLimitNeverAuthorizesARequest() {
    assertEquals("SOURCE_BUDGET_REQUIRED",assertThrows(CollectorFailure.class,()->new DirectRequestBudget(null,"fixture",10,x->{})).getMessage());
    for(int limit:List.of(0,-1,1000001))assertThrows(CollectorFailure.class,()->new DirectRequestBudget(TestSourceControls.mockStore(),"fixture",limit,x->{}));
  }
  @Test void failedAndExpiredPermitsFailClosed() throws Exception {
    var store=TestSourceControls.mockStore();var c=mock(Connection.class);var q=mock(PreparedStatement.class);var row=mock(ResultSet.class);
    when(store.connection()).thenReturn(c);when(c.getAutoCommit()).thenReturn(true);when(c.prepareStatement(anyString())).thenReturn(q);
    when(q.executeQuery()).thenReturn(row);when(row.next()).thenReturn(true);when(row.getLong(1)).thenReturn(0L);when(row.getLong(2)).thenReturn(2000L);
    var clock=new AtomicLong();
    var budget=new DirectRequestBudget(store,"fixture",10,x->{},()->clock.getAndAdd(3_000_000_000L));
    assertEquals("SOURCE_PERMIT_EXPIRED",assertThrows(CollectorFailure.class,()->budget.reserve(10000)).getMessage());
    when(q.executeQuery()).thenThrow(new SQLException("unavailable"));
    assertEquals("SOURCE_BUDGET_UNAVAILABLE",assertThrows(CollectorFailure.class,()->budget.reserve(10000)).getMessage());
    when(c.getAutoCommit()).thenReturn(false);
    assertEquals("SOURCE_BUDGET_TRANSACTION_OPEN",assertThrows(CollectorFailure.class,()->budget.reserve(10000)).getMessage());
  }
  @Test void postgresPersistsConcurrentQuotaRestartAndKstRollover() throws Exception {
    String jdbc=System.getenv("COLLECTOR_READBACK_DATABASE_URL");
    Assumptions.assumeTrue(jdbc!=null&&!jdbc.isBlank(),"COLLECTOR_READBACK_DATABASE_URL not set");
    var config=new HikariConfig();config.setJdbcUrl(jdbc);config.setMaximumPoolSize(5);
    config.setUsername(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_USER","blariyo_local"));
    config.setPassword(System.getenv().getOrDefault("COLLECTOR_READBACK_DATABASE_PASSWORD",""));
    MigrationMain.migrate(jdbc,config.getUsername(),config.getPassword());
    String source="budget-"+UUID.randomUUID();
    try(var db=new HikariDataSource(config)) {
      // Real server-side waits: two independent budget objects share the same committed aggregate.
      new DirectRequestBudget(new BatchStore(db),source,2,DirectRequestBudgetTests::sleep).reserve(0);
      long started=System.nanoTime();
      new DirectRequestBudget(new BatchStore(db),source,2,DirectRequestBudgetTests::sleep).reserve(0);
      assertTrue(System.nanoTime()-started>=1_500_000_000L,"second reservation must wait for prior permit to end");
      assertEquals("SOURCE_DAILY_LIMIT_EXCEEDED",assertThrows(CollectorFailure.class,
        ()->new DirectRequestBudget(new BatchStore(db),source,2,x->fail("exhausted quota must stop")).reserve(0)).getMessage());
      // The fixture owner sets a historical aggregate; the function still uses the real DB clock.
      try(var c=db.getConnection();var q=c.prepareStatement("UPDATE collect.batch_request_budget SET budget_date=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date-1,request_count=2,next_allowed_at=clock_timestamp()+interval '200 milliseconds' WHERE source_key=?")) {
        q.setString(1,source);q.executeUpdate();
      }
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT * FROM collect.reserve_batch_request(?,2,0)")) {
        q.setString(1,source);try(var row=q.executeQuery()){assertTrue(row.next());assertTrue(row.getLong("wait_ms")>0);assertEquals(0,row.getLong("valid_ms"));}
      }
      Thread.sleep(220);
      try(var threads=Executors.newFixedThreadPool(4)) {
        var calls=new ArrayList<Future<Boolean>>();
        for(int i=0;i<4;i++)calls.add(threads.submit(()->{
          try(var c=db.getConnection();var q=c.prepareStatement("SELECT * FROM collect.reserve_batch_request(?,2,0)")) {
            q.setString(1,source);try(var row=q.executeQuery()){assertTrue(row.next());return row.getLong("valid_ms")>0;}
          }
        }));
        int permits=0;for(var result:calls)if(result.get(10,TimeUnit.SECONDS))permits++;
        assertEquals(1,permits,"row lock permits only one sender");
      }
      try(var c=db.getConnection();var q=c.prepareStatement("SELECT budget_date=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date,request_count FROM collect.batch_request_budget WHERE source_key=?")) {
        q.setString(1,source);try(var row=q.executeQuery()){assertTrue(row.next());assertTrue(row.getBoolean(1));assertEquals(1,row.getInt(2));}
      }
      // A new pool is a process-restart equivalent for the database-owned counter.
    }
    try(var restarted=new HikariDataSource(config)) {
      new DirectRequestBudget(new BatchStore(restarted),source,2,DirectRequestBudgetTests::sleep).reserve(0);
      assertEquals("SOURCE_DAILY_LIMIT_EXCEEDED",assertThrows(CollectorFailure.class,
        ()->new DirectRequestBudget(new BatchStore(restarted),source,2,x->{}).reserve(0)).getMessage());
      try(var c=restarted.getConnection();var q=c.createStatement()) {
        q.execute("UPDATE collector.restore_gate SET reconcile_required=true");
        try {
          var restored=new DirectRequestBudget(new BatchStore(restarted),source+"-restore",10,x->{});
          assertEquals("SOURCE_RESTORE_RECONCILE_REQUIRED",assertThrows(CollectorFailure.class,()->restored.reserve(0)).getMessage());
          q.execute("UPDATE collector.restore_gate SET reconcile_required=false,direct_resume_not_before=clock_timestamp()+interval '1 hour'");
          assertEquals("SOURCE_RESTORE_RECONCILE_REQUIRED",assertThrows(CollectorFailure.class,()->restored.reserve(0)).getMessage());
        } finally {q.execute("UPDATE collector.restore_gate SET reconcile_required=false,direct_resume_not_before=NULL");}
      }
    }
  }
  private static void sleep(long millis) {
    try{Thread.sleep(millis);}catch(InterruptedException error){Thread.currentThread().interrupt();throw new AssertionError(error);}
  }
}
