package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.stereotype.Repository;

/** Batch-owned ledger. It never calls the Core HTTP API and never writes content tables. */
@Repository
public final class BatchStore {
  private final DataSource dataSource;
  public BatchStore(DataSource dataSource) { this.dataSource = dataSource; }
  private final ThreadLocal<SourceLock> activeLock = new ThreadLocal<>();
  public Connection connection() throws SQLException {
    var lock = activeLock.get();
    if (lock == null) return dataSource.getConnection();
    // A lost lease is fatal for this execution: never borrow a replacement connection.
    if (lock.closed || lock.connection.isClosed()) throw new SQLException("BATCH_OWNER_LOST", "08003");
    return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class<?>[]{Connection.class},
        (proxy, method, args) -> {
          if (method.getName().equals("close")) {
            if (!lock.connection.getAutoCommit()) {
              lock.connection.rollback();
              lock.connection.setAutoCommit(true);
            }
            return null;
          }
          try { return method.invoke(lock.connection, args); }
          catch (InvocationTargetException error) { throw error.getCause(); }
        });
  }
  public void registerSource(String source,String host) {
    try(var c=connection();var s=c.prepareStatement("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled) VALUES(?,?,'config',true) ON CONFLICT(source_key) DO UPDATE SET host=EXCLUDED.host,updated_at=now()")) {
      s.setString(1,source);s.setString(2,host);s.executeUpdate();
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  /** Session lock serializes manual/list collectors for one source, including restart recovery. */
  public SourceLock lockSource(String source) {
    if (activeLock.get() != null) throw new CollectorFailure(409,"BATCH_SOURCE_BUSY");
    Connection connection=null;
    try {
      connection=dataSource.getConnection();
      try(var statement=connection.prepareStatement("SELECT pg_try_advisory_lock(hashtextextended(?,0))")) {
        statement.setString(1,"collector-source:"+source);
        try(var result=statement.executeQuery()) {
          result.next();if(!result.getBoolean(1))throw new CollectorFailure(409,"BATCH_SOURCE_BUSY");
        }
      }
      var lock = new SourceLock(connection,source);
      activeLock.set(lock);
      return lock;
    }catch(SQLException|RuntimeException e) {
      if(connection!=null)try{connection.close();}catch(SQLException ignored){}
      if(e instanceof CollectorFailure failure)throw failure;
      throw new CollectorFailure(503,"BATCH_DB_UNAVAILABLE");
    }
  }
  public final class SourceLock implements AutoCloseable {
    private final Connection connection;private final String source;private boolean closed;
    private SourceLock(Connection connection,String source){this.connection=connection;this.source=source;}
    @Override public void close() {
      if (closed) return;
      closed = true;
      if (activeLock.get() == this) activeLock.remove();
      try {
        if (!connection.getAutoCommit()) { connection.rollback(); connection.setAutoCommit(true); }
      } catch (SQLException ignored) {}
      try(var statement=connection.prepareStatement("SELECT pg_advisory_unlock(hashtextextended(?,0))")) {
        statement.setString(1,"collector-source:"+source);statement.execute();
      }catch(SQLException e){try{connection.abort(Runnable::run);}catch(SQLException ignored){} }
      finally{try{connection.close();}catch(SQLException ignored){}}
    }
  }
  public UUID queueManual(String source,String postKey,String url) {
    return new BatchQueueStore(this).enqueue(source,postKey,url);
  }
  public void media(UUID item,int position,String kind,String remote,String objectKey,byte[] sha256,String mime,long byteSize){try(var c=connection();var s=c.prepareStatement("INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,object_key,sha256,mime_type,byte_size) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id,position) DO NOTHING")){s.setObject(1,UUID.randomUUID());s.setObject(2,item);s.setInt(3,position);s.setString(4,kind);s.setString(5,remote);s.setString(6,objectKey);s.setBytes(7,sha256);s.setString(8,mime);s.setLong(9,byteSize);s.executeUpdate();}catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}}
  public UUID begin(String source, String chart, String mode, int pages, int items, long interval, Instant since) {
    UUID id=UUID.randomUUID();
    try (var c=connection(); var s=c.prepareStatement("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,since_at,interval_ms) VALUES(?,?,?,?,?,?,?,?,?)")) {
      c.setAutoCommit(false);
      ensureSource(c, source, "config");
      // The caller holds the source session lock, so remaining RUNNING runs lost their owner.
      try(var abandoned=c.prepareStatement("UPDATE collect.batch_run SET state='FAILED',finished_at=now(),checkpoint=checkpoint || '{\"reason\":\"BATCH_OWNER_LOST\"}'::jsonb,version=version+1 WHERE source_key=? AND state='RUNNING'")) {
        abandoned.setString(1,source);abandoned.executeUpdate();
      }
      s.setObject(1,id);s.setString(2,source);s.setString(3,chart);s.setString(4,mode);s.setString(5,"RUNNING");s.setInt(6,pages);s.setInt(7,items);if(since==null)s.setNull(8,Types.TIMESTAMP_WITH_TIMEZONE);else s.setTimestamp(8,Timestamp.from(since));s.setLong(9,interval);s.executeUpdate();c.commit();return id;
    } catch(SQLException e) { throw new CollectorFailure(503,"BATCH_DB_UNAVAILABLE"); }
  }
  public UUID item(UUID run,String source,String postKey,String url,String state,String title,String blocks,String sns,String raw) {
    return item(run,source,postKey,url,state,title,blocks,"[]",sns,raw);
  }
  public UUID item(UUID run,String source,String postKey,String url,String state,String title,String blocks,String attachments,String sns,String raw) {
    try (var c=connection()) {
      c.setAutoCommit(false);
      try {
        UUID item=insertItem(c,run,source,postKey,url,state,title,blocks,attachments,sns,raw);
        // Only a claimed incomplete item is reset. Completed/reviewable snapshots are immutable.
        if(item!=null && "FETCHING".equals(state))try(var delete=c.prepareStatement("DELETE FROM collect.batch_media WHERE item_id=?")) {
          delete.setObject(1,item);delete.executeUpdate();
        }
        c.commit();return item;
      }catch(SQLException|RuntimeException e){c.rollback();throw e;}
    } catch(SQLException e) { if("23505".equals(e.getSQLState())) return null; throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED"); }
  }
  public UUID claim(UUID run,String source,String postKey,String url) {
    return item(run,source,postKey,url,"FETCHING",null,"[]","[]","[]",null);
  }
  public void parsed(UUID item,String canonical,String title,String blocks,String attachments,String sns) {
    try(var c=connection();var s=c.prepareStatement("""
        UPDATE collect.batch_item SET canonical_url=?,canonical_url_hash=?,title=?,body_blocks=?::jsonb,
          attachment_metadata=?::jsonb,sns_links=?::jsonb,version=version+1 WHERE id=? AND state='FETCHING'
        """)) {
      s.setString(1,canonical);s.setBytes(2,sha(canonical));s.setString(3,title);s.setString(4,blocks);
      s.setString(5,attachments);s.setString(6,sns);s.setObject(7,item);
      if(s.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_ITEM_LOCK_CONFLICT");
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  public void skipItem(UUID item,String reason) {
    try(var c=connection();var s=c.prepareStatement("UPDATE collect.batch_item SET state='SKIPPED_POLICY',skip_reason=?,version=version+1 WHERE id=? AND state='FETCHING'")) {
      s.setString(1,reason);s.setObject(2,item);
      if(s.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_ITEM_LOCK_CONFLICT");
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  public void checkpoint(UUID run, Map<String,Object> state) {
    try (var c=connection()) { checkpoint(c,run,state); }
    catch(SQLException e) { throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED"); }
  }
  private static void checkpoint(Connection c, UUID run, Map<String,Object> state) throws SQLException {
    try(var s=c.prepareStatement("""
        INSERT INTO collect.batch_checkpoint(run_id,page_number,item_count,state) VALUES(?,?,?,?::jsonb)
        ON CONFLICT(run_id) DO UPDATE SET page_number=EXCLUDED.page_number,item_count=EXCLUDED.item_count,
          state=EXCLUDED.state,version=collect.batch_checkpoint.version+1,updated_at=now()
        """)) {
      s.setObject(1,run);s.setInt(2,((Number)state.getOrDefault("pages",0)).intValue());
      s.setInt(3,((Number)state.getOrDefault("items",0)).intValue());s.setString(4,Json.tree(state).toString());s.executeUpdate();
    }
  }
  public void finish(UUID run,String state,Map<String,Object> checkpoint,String reportKey,byte[] reportHash) {
    try(var c=connection()) {
      c.setAutoCommit(false);
      try {
        checkpoint(c,run,checkpoint);
        try(var s=c.prepareStatement("INSERT INTO collect.batch_report(run_id,object_key,sha256,jsonl_count) VALUES(?,?,?,1)")) {
          s.setObject(1,run);s.setString(2,reportKey);s.setBytes(3,reportHash);s.executeUpdate();
        }
        try(var s=c.prepareStatement("UPDATE collect.batch_run SET state=?,finished_at=now(),checkpoint=?,report_object_key=?,version=version+1 WHERE id=? AND state='RUNNING'")) {
          s.setString(1,state);s.setObject(2,Json.tree(checkpoint),Types.OTHER);s.setString(3,reportKey);s.setObject(4,run);
          if(s.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_RUN_LOCK_CONFLICT");
        }
        c.commit();
      }catch(SQLException|RuntimeException error){c.rollback();throw error;}
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  public void raw(UUID item,String objectKey){
    try(var c=connection();var s=c.prepareStatement("UPDATE collect.batch_item SET raw_object_key=?,version=version+1 WHERE id=? AND state='FETCHING'")){
      s.setString(1,objectKey);s.setObject(2,item);if(s.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_ITEM_LOCK_CONFLICT");
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  public void completeItem(UUID item) {
    try (var c = connection(); var s = c.prepareStatement("UPDATE collect.batch_item SET state='FETCHED',fetched_at=now(),version=version+1 WHERE id=? AND state='FETCHING'")) {
      s.setObject(1, item);
      if (s.executeUpdate() != 1) throw new CollectorFailure(409, "BATCH_ITEM_LOCK_CONFLICT");
    } catch (SQLException e) { throw new CollectorFailure(503, "BATCH_DB_WRITE_FAILED"); }
  }
  public void failItem(UUID run, UUID item, String phase, String code) {
    failItem(run, item, phase, code, Map.of());
  }
  public void failItem(UUID run, UUID item, String phase, String code, Map<String, Object> detail) {
    try (var c = connection()) {
      c.setAutoCommit(false);
      try {
        if (item != null) {
          try (var s = c.prepareStatement("UPDATE collect.batch_item SET state=CASE WHEN ? IN ('SOURCE_ACCESS_BLOCKED','SOURCE_NOT_ALLOWED') THEN 'BLOCKED' ELSE 'FAILED' END,failure_code=?,version=version+1 WHERE id=? AND state='FETCHING' AND run_id=?")) {
            s.setString(1, code);s.setString(2,code);s.setObject(3, item);s.setObject(4,run);
            if (s.executeUpdate() != 1) throw new CollectorFailure(409, "BATCH_ITEM_LOCK_CONFLICT");
          }
        }
        try (var s = c.prepareStatement("INSERT INTO collect.batch_failure(id,run_id,item_id,phase,code,detail) VALUES(?,?,?,?,?,?::jsonb)")) {
          s.setObject(1, UUID.randomUUID());
          s.setObject(2, run);
          if (item == null) s.setNull(3, Types.OTHER); else s.setObject(3, item);
          s.setString(4, phase);
          s.setString(5, code);
          s.setString(6, Json.tree(detail == null ? Map.of() : detail).toString());
          s.executeUpdate();
        }
        c.commit();
      } catch (RuntimeException | SQLException e) {
        try { c.rollback(); } catch (SQLException ignored) {}
        if (e instanceof RuntimeException r) throw r;
        throw e;
      }
    } catch (SQLException e) { throw new CollectorFailure(503, "BATCH_DB_WRITE_FAILED"); }
  }
  private static void ensureSource(Connection c,String source,String policy) throws SQLException {
    try(var sourceInsert=c.prepareStatement("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled) VALUES(?,?,?,true) ON CONFLICT(source_key) DO NOTHING")){
      sourceInsert.setString(1,source);sourceInsert.setString(2,source);sourceInsert.setString(3,policy);sourceInsert.executeUpdate();
    }
  }
  private static UUID insertItem(Connection c,UUID run,String source,String postKey,String url,String state,String title,String blocks,String attachments,String sns,String raw) throws SQLException {
    UUID id=UUID.randomUUID(); byte[] hash=sha(url);
    String sql = """
        INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,attachment_metadata,sns_links,raw_object_key,fetched_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?='FETCHED' THEN now() ELSE NULL END)
        ON CONFLICT(source_key,source_post_key) DO UPDATE SET
          run_id=EXCLUDED.run_id,
          failure_code=NULL,
          skip_reason=NULL,
          canonical_url=EXCLUDED.canonical_url,
          canonical_url_hash=EXCLUDED.canonical_url_hash,
          state=EXCLUDED.state,
          title=EXCLUDED.title,
          body_blocks=EXCLUDED.body_blocks,
          attachment_metadata=EXCLUDED.attachment_metadata,
          sns_links=EXCLUDED.sns_links,
          raw_object_key=EXCLUDED.raw_object_key,
          fetched_at=CASE WHEN EXCLUDED.state='FETCHED' THEN now() ELSE collect.batch_item.fetched_at END,
          version=collect.batch_item.version+1
        WHERE EXCLUDED.state='FETCHING' AND collect.batch_item.state IN ('DISCOVERED','FAILED','BLOCKED','FETCHING','SKIPPED_POLICY')
        RETURNING id
        """;
    try (var s=c.prepareStatement(sql)) {
      s.setObject(1,id);s.setObject(2,run);s.setString(3,source);s.setString(4,postKey);s.setString(5,url);s.setBytes(6,hash);s.setString(7,state);s.setString(8,title);
      if(blocks==null)s.setNull(9,Types.OTHER);else s.setObject(9,blocks,Types.OTHER);
      s.setObject(10,attachments==null?"[]":attachments,Types.OTHER);s.setObject(11,sns==null?"[]":sns,Types.OTHER);s.setString(12,raw);s.setString(13,state);
      try(var rs=s.executeQuery()){return rs.next()?(UUID)rs.getObject(1):null;}
    }
  }
  public static byte[] sha(String text){try{return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));}catch(Exception e){throw new IllegalStateException(e);}}
}
