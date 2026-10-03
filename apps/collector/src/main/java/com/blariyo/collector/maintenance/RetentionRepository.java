package com.blariyo.collector.maintenance;

import com.blariyo.collector.shared.CollectorFailure;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;

/** Every call is a short database transaction; no object I/O holds a row lock. */
public final class RetentionRepository {
  public record Lease(UUID item, UUID run, UUID owner, long version) {}
  private final DataSource db;
  public RetentionRepository(DataSource db) { this.db=db; }
  private static CollectorFailure failure(SQLException e) {
    String code=e.getSQLState()!=null && e.getSQLState().matches("[A-Z0-9]{5}")
        ? "RETENTION_DATABASE_"+e.getSQLState() : "RETENTION_DATABASE_FAILED";
    for(String known:List.of("RETENTION_BACKUP_GATE_CLOSED","PURGE_LEASE_LOST",
        "RETENTION_ORPHAN_REQUIRES_QUIESCED_INVENTORY","RESTORE_REQUIRES_COLLECTION_IDLE","RETENTION_RESTORE_BUSY")) {
      if(e.getMessage()!=null && e.getMessage().contains(known))code=known;
    }
    return new CollectorFailure(503,code);
  }
  public Lease claim() {
    UUID owner=UUID.randomUUID();
    try(var c=db.getConnection();var q=c.prepareStatement("SELECT item_id,run_id,version FROM collect.claim_retention(?,1)")) {
      q.setObject(1,owner);try(var r=q.executeQuery()) {
        return r.next()?new Lease((UUID)r.getObject(1),(UUID)r.getObject(2),owner,r.getLong(3)):null;
      }
    } catch(SQLException e) { throw failure(e); }
  }
  private void call(String sql, Object... values) {
    try(var c=db.getConnection();var q=c.prepareStatement(sql)) {
      for(int i=0;i<values.length;i++)q.setObject(i+1,values[i]);q.execute();
    } catch(SQLException e) { throw failure(e); }
  }
  public void heartbeat(Lease lease) { call("SELECT collect.heartbeat_retention(?,?,?)",lease.item(),lease.owner(),lease.version()); }
  public void observe(String key,boolean restore) { call("SELECT collect.observe_retention_object(?,?)",key,restore); }
  public void inventory(Lease lease,String key) { call("SELECT collect.record_purge_inventory(?,?,?,?)",lease.item(),lease.owner(),lease.version(),key); }
  public List<String> objects(Lease lease) {
    try(var c=db.getConnection();var q=c.prepareStatement("SELECT object_key FROM collect.retention_objects(?,?,?) WHERE deletion_state<>'DELETED'")) {
      q.setObject(1,lease.item());q.setObject(2,lease.owner());q.setLong(3,lease.version());
      try(var r=q.executeQuery()) { var result=new ArrayList<String>();while(r.next())result.add(r.getString(1));return result; }
    } catch(SQLException e) { throw failure(e); }
  }
  public void result(Lease lease,String key,boolean deleted,String code) {
    call("SELECT collect.record_purge_result(?,?,?,?,?,?)",lease.item(),lease.owner(),lease.version(),key,deleted,code);
  }
  public void fail(Lease lease) { call("SELECT collect.fail_retention(?,?,?)",lease.item(),lease.owner(),lease.version()); }
  public void finish(Lease lease) { call("SELECT collect.finish_retention(?,?,?)",lease.item(),lease.owner(),lease.version()); }
  public void cleanup() { call("SELECT collect.cleanup_retention_ledger()"); }
  public void metadata() { call("SELECT collect.cleanup_retention_metadata()"); call("SELECT collect.prepare_expired_run_retention()"); }
  public RestoreFence restoreFence(boolean enabled) {
    Connection connection=null;
    try {
      if(enabled) {
        connection=db.getConnection();
        try(var sql=connection.createStatement()) { sql.execute("SELECT collect.lock_retention_restore()"); }
      }
      return new RestoreFence(connection);
    } catch(SQLException e) {
      if(connection!=null)try{connection.close();}catch(SQLException ignored){}
      throw failure(e);
    }
  }
  public static final class RestoreFence implements AutoCloseable {
    private final Connection connection;
    private RestoreFence(Connection connection) { this.connection=connection; }
    public void close() {
      if(connection==null)return;
      try(var sql=connection.createStatement()) { sql.execute("SELECT collect.unlock_retention_restore()"); }
      catch(SQLException e) { try{connection.abort(Runnable::run);}catch(SQLException ignored){} throw failure(e); }
      finally {try{connection.close();}catch(SQLException ignored){}}
    }
  }
}
