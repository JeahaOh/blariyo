package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.stereotype.Repository;

/** Batch-owned ledger. It never calls the Core HTTP API and never writes content tables. */
@Repository
public final class BatchStore {
  private final DataSource dataSource;
  public BatchStore(DataSource dataSource) { this.dataSource = dataSource; }
  public Connection connection() throws SQLException { return dataSource.getConnection(); }
  public UUID queueManual(String source,String postKey,String url) {
    UUID run=UUID.randomUUID();
    try(var c=connection()) {
      c.setAutoCommit(false);
      try {
        ensureSource(c, source, "discord");
        try(var s=c.prepareStatement("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,interval_ms) VALUES(?,?,?,'WRITE_DB','QUEUED',1,1,10000)")){
          s.setObject(1,run);s.setString(2,source);s.setString(3,"discord");s.executeUpdate();
        }
        if(insertItem(c,run,source,postKey,url,"DISCOVERED",null,null,"[]",null)==null)
          throw new CollectorFailure(409,"BATCH_DUPLICATE");
        c.commit();
        return run;
      } catch (RuntimeException e) {
        try { c.rollback(); } catch (SQLException ignored) {}
        throw e;
      }
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  public void media(UUID item,int position,String kind,String remote,String objectKey,byte[] sha256,String mime,long byteSize){try(var c=connection();var s=c.prepareStatement("INSERT INTO collect.batch_media(id,item_id,position,kind,remote_url,object_key,sha256,mime_type,byte_size) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id,position) DO NOTHING")){s.setObject(1,UUID.randomUUID());s.setObject(2,item);s.setInt(3,position);s.setString(4,kind);s.setString(5,remote);s.setString(6,objectKey);s.setBytes(7,sha256);s.setString(8,mime);s.setLong(9,byteSize);s.executeUpdate();}catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}}
  public UUID begin(String source, String chart, String mode, int pages, int items, long interval, Instant since) {
    UUID id=UUID.randomUUID();
    try (var c=connection(); var s=c.prepareStatement("INSERT INTO collect.batch_run(id,source_key,chart_key,mode,state,max_pages,max_items,since_at,interval_ms) VALUES(?,?,?,?,?,?,?,?,?)")) {
      ensureSource(c, source, "config");
      s.setObject(1,id);s.setString(2,source);s.setString(3,chart);s.setString(4,mode);s.setString(5,"RUNNING");s.setInt(6,pages);s.setInt(7,items);if(since==null)s.setNull(8,Types.TIMESTAMP_WITH_TIMEZONE);else s.setObject(8,since);s.setLong(9,interval);s.executeUpdate();return id;
    } catch(SQLException e) { throw new CollectorFailure(503,"BATCH_DB_UNAVAILABLE"); }
  }
  public UUID item(UUID run,String source,String postKey,String url,String state,String title,String blocks,String sns,String raw) {
    try (var c=connection()) {
      return insertItem(c,run,source,postKey,url,state,title,blocks,sns,raw);
    } catch(SQLException e) { if("23505".equals(e.getSQLState())) return null; throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED"); }
  }
  public void finish(UUID run,String state,Map<String,Object> checkpoint,String reportKey) {
    try(var c=connection();var s=c.prepareStatement("UPDATE collect.batch_run SET state=?,finished_at=now(),checkpoint=?,report_object_key=?,version=version+1 WHERE id=? AND state='RUNNING'")){s.setString(1,state);s.setObject(2,Json.tree(checkpoint),Types.OTHER);s.setString(3,reportKey);s.setObject(4,run);if(s.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_RUN_LOCK_CONFLICT");}catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  public void raw(UUID item,String objectKey){
    try(var c=connection();var s=c.prepareStatement("UPDATE collect.batch_item SET raw_object_key=?,version=version+1 WHERE id=?")){
      s.setString(1,objectKey);s.setObject(2,item);if(s.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_ITEM_LOCK_CONFLICT");
    }catch(SQLException e){throw new CollectorFailure(503,"BATCH_DB_WRITE_FAILED");}
  }
  private static void ensureSource(Connection c,String source,String policy) throws SQLException {
    try(var sourceInsert=c.prepareStatement("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled) VALUES(?,?,?,true) ON CONFLICT(source_key) DO NOTHING")){
      sourceInsert.setString(1,source);sourceInsert.setString(2,source);sourceInsert.setString(3,policy);sourceInsert.executeUpdate();
    }
  }
  private static UUID insertItem(Connection c,UUID run,String source,String postKey,String url,String state,String title,String blocks,String sns,String raw) throws SQLException {
    UUID id=UUID.randomUUID(); byte[] hash=sha(url);
    try (var s=c.prepareStatement("INSERT INTO collect.batch_item(id,run_id,source_key,source_post_key,canonical_url,canonical_url_hash,state,title,body_blocks,sns_links,raw_object_key) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING")) {
      s.setObject(1,id);s.setObject(2,run);s.setString(3,source);s.setString(4,postKey);s.setString(5,url);s.setBytes(6,hash);s.setString(7,state);s.setString(8,title);
      if(blocks==null)s.setNull(9,Types.OTHER);else s.setObject(9,blocks,Types.OTHER);
      s.setObject(10,sns==null?"[]":sns,Types.OTHER);s.setString(11,raw);
      return s.executeUpdate()==1?id:null;
    }
  }
  public static byte[] sha(String text){try{return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));}catch(Exception e){throw new IllegalStateException(e);}}
}
