package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import java.sql.*;
import java.util.*;

/** Durable requests and private confirmation receipts. Never reads or writes Core content. */
public final class BatchQueueStore {
  public record Confirmation(UUID id,String source,String postKey,String url,UUID requestId) {}
  public record Request(UUID id,String source,String postKey,String url,String state,int attempts,UUID runId,long version) {}
  private final BatchStore store;
  public BatchQueueStore(BatchStore store){this.store=store;}
  private static CollectorFailure database(){return new CollectorFailure(503,"BATCH_QUEUE_DB_FAILED");}
  public Confirmation prepare(String trigger,String actor,String channel,String source,String postKey,String url) {
    try(var c=store.connection()) {
      try(var q=c.prepareStatement("INSERT INTO collect.batch_confirmation(id,trigger_hmac,actor_hmac,channel_hmac,source_key,source_post_key,canonical_url) VALUES(?,?,?,?,?,?,?) ON CONFLICT(trigger_hmac) DO NOTHING")) {
        q.setObject(1,UUID.randomUUID());q.setString(2,trigger);q.setString(3,actor);q.setString(4,channel);q.setString(5,source);q.setString(6,postKey);q.setString(7,url);q.executeUpdate();
      }
      try(var q=c.prepareStatement("SELECT * FROM collect.batch_confirmation WHERE trigger_hmac=?")) {
        q.setString(1,trigger);try(var r=q.executeQuery()){if(!r.next())throw database();
          authorize(r,actor,channel);
          if(!source.equals(r.getString("source_key"))||!postKey.equals(r.getString("source_post_key"))||!url.equals(r.getString("canonical_url")))
            throw new CollectorFailure(409,"IDEMPOTENCY_CONFLICT");
          return confirmation(r);
        }
      }
    }catch(SQLException e){throw database();}
  }
  public Confirmation confirmation(UUID id,String actor,String channel) {
    try(var c=store.connection();var q=c.prepareStatement("SELECT * FROM collect.batch_confirmation WHERE id=?")) {
      q.setObject(1,id);try(var r=q.executeQuery()){if(!r.next())throw new CollectorFailure(409,"CONFIRMATION_EXPIRED");authorize(r,actor,channel);return confirmation(r);}
    }catch(SQLException e){throw database();}
  }
  public UUID confirm(UUID id,String actor,String channel) {
    try(var c=store.connection()) {
      c.setAutoCommit(false);
      try {
        UUID request;
        try(var q=c.prepareStatement("SELECT *,expires_at<=now() AS expired FROM collect.batch_confirmation WHERE id=? FOR UPDATE")) {
          q.setObject(1,id);try(var r=q.executeQuery()) {
            if(!r.next())throw new CollectorFailure(409,"CONFIRMATION_EXPIRED");authorize(r,actor,channel);
            request=(UUID)r.getObject("request_id");
            if(request!=null){c.commit();return request;}
            if(r.getBoolean("expired"))throw new CollectorFailure(409,"CONFIRMATION_EXPIRED");
            request=enqueue(c,r.getString("source_key"),r.getString("source_post_key"),r.getString("canonical_url"));
          }
        }
        try(var q=c.prepareStatement("UPDATE collect.batch_confirmation SET request_id=?,version=version+1 WHERE id=? AND request_id IS NULL")) {
          q.setObject(1,request);q.setObject(2,id);if(q.executeUpdate()!=1)throw new CollectorFailure(409,"CONFIRMATION_CONFLICT");
        }
        c.commit();return request;
      }catch(SQLException|RuntimeException e){c.rollback();throw e;}
    }catch(SQLException e){throw database();}
  }
  public UUID enqueue(String source,String postKey,String url) {
    try(var c=store.connection()){c.setAutoCommit(false);try{UUID id=enqueue(c,source,postKey,url);c.commit();return id;}catch(SQLException|RuntimeException e){c.rollback();throw e;}}
    catch(SQLException e){throw database();}
  }
  private UUID enqueue(Connection c,String source,String postKey,String url) throws SQLException {
    try(var q=c.prepareStatement("INSERT INTO collect.batch_source(source_key,host,policy_version,enabled) VALUES(?,?,'discord',true) ON CONFLICT(source_key) DO NOTHING")) {
      q.setString(1,source);q.setString(2,java.net.URI.create(url).getHost());q.executeUpdate();
    }
    UUID id=UUID.randomUUID();
    try(var q=c.prepareStatement("INSERT INTO collect.batch_queue(id,source_key,source_post_key,canonical_url,canonical_url_hash) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id")) {
      q.setObject(1,id);q.setString(2,source);q.setString(3,postKey);q.setString(4,url);q.setBytes(5,BatchStore.sha(url));try(var r=q.executeQuery()){if(r.next())return (UUID)r.getObject(1);}
    }
    try(var q=c.prepareStatement("SELECT * FROM collect.batch_queue WHERE source_key=? AND (source_post_key=? OR canonical_url_hash=?) ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE")) {
      q.setString(1,source);q.setString(2,postKey);q.setBytes(3,BatchStore.sha(url));try(var r=q.executeQuery()) {
        if(!r.next()||!postKey.equals(r.getString("source_post_key"))||!url.equals(r.getString("canonical_url")))throw new CollectorFailure(409,"BATCH_QUEUE_IDENTITY_CONFLICT");
        return (UUID)r.getObject("id");
      }
    }
  }
  public List<String> readySources() {
    try(var c=store.connection();var q=c.createStatement();var r=q.executeQuery("SELECT q.source_key FROM collect.batch_queue q WHERE q.state='RUNNING' OR (q.state='QUEUED' AND q.next_attempt_at<=now() AND NOT EXISTS (SELECT 1 FROM collect.batch_queue stopped WHERE stopped.source_key=q.source_key AND stopped.error_code IN ('SOURCE_ACCESS_BLOCKED','SOURCE_NOT_ALLOWED','SOURCE_RATE_LIMITED') AND stopped.updated_at>now()-interval '15 minutes')) GROUP BY q.source_key ORDER BY min(q.created_at) LIMIT 100")) {
      var result=new ArrayList<String>();while(r.next())result.add(r.getString(1));return result;
    }catch(SQLException e){throw database();}
  }
  public Request next(String source) {
    try(var c=store.connection();var q=c.prepareStatement("SELECT * FROM collect.batch_queue WHERE source_key=? AND (state='RUNNING' OR (state='QUEUED' AND next_attempt_at<=now())) ORDER BY CASE WHEN state='RUNNING' THEN 0 ELSE 1 END,created_at,id LIMIT 1")) {
      q.setString(1,source);try(var r=q.executeQuery()){return r.next()?request(r):null;}
    }catch(SQLException e){throw database();}
  }
  public Request claim(Request request) {
    try(var c=store.connection();var q=c.prepareStatement("UPDATE collect.batch_queue SET state='RUNNING',attempts=attempts+1,active_run_id=NULL,error_code=NULL,version=version+1 WHERE id=? AND version=? AND state='QUEUED' RETURNING *")) {
      q.setObject(1,request.id());q.setLong(2,request.version());try(var r=q.executeQuery()){if(!r.next())throw new CollectorFailure(409,"BATCH_QUEUE_CONFLICT");return request(r);}
    }catch(SQLException e){throw database();}
  }
  public void attach(UUID id,UUID run) {
    try(var c=store.connection();var q=c.prepareStatement("UPDATE collect.batch_queue SET active_run_id=?,version=version+1 WHERE id=? AND state='RUNNING' AND active_run_id IS NULL")) {
      q.setObject(1,run);q.setObject(2,id);if(q.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_QUEUE_CONFLICT");
    }catch(SQLException e){throw database();}
  }
  /** Called while holding the same source session lock as the collection runner. */
  public void settle(UUID id) {
    try(var c=store.connection()) {
      c.setAutoCommit(false);
      try {
        Request request;
        try(var q=c.prepareStatement("SELECT * FROM collect.batch_queue WHERE id=? AND state='RUNNING' FOR UPDATE")) {
          q.setObject(1,id);try(var r=q.executeQuery()){if(!r.next()){c.commit();return;}request=request(r);}
        }
        String state="FAILED",error="BATCH_OWNER_LOST";
        if(request.runId()!=null) {
          try(var q=c.prepareStatement("SELECT state,checkpoint->>'reason' AS reason FROM collect.batch_run WHERE id=?")) {
            q.setObject(1,request.runId());try(var r=q.executeQuery()){if(!r.next())throw database();state=r.getString("state");if(r.getString("reason")!=null)error=r.getString("reason");}
          }
          if(state.equals("RUNNING")) {
            try(var q=c.prepareStatement("UPDATE collect.batch_run SET state='FAILED',finished_at=now(),checkpoint=checkpoint || '{\"reason\":\"BATCH_OWNER_LOST\"}'::jsonb,version=version+1 WHERE id=?")) {
              q.setObject(1,request.runId());q.executeUpdate();
            }
            state="FAILED";error="BATCH_OWNER_LOST";
          }
          if(state.equals("COMPLETED"))error=null;
        }
        boolean retry=state.equals("FAILED")&&request.attempts()<3&&Set.of("BATCH_OWNER_LOST","SOURCE_FETCH_FAILED","SOURCE_DNS_FAILED","SOURCE_HTTP_UNAVAILABLE").contains(error);
        try(var q=c.prepareStatement("UPDATE collect.batch_queue SET state=?,error_code=?,owner_backend_pid=NULL,next_attempt_at=now()+(? * interval '1 second'),version=version+1 WHERE id=? AND version=?")) {
          q.setString(1,retry?"QUEUED":state);q.setString(2,error);q.setLong(3,30L << Math.max(0,request.attempts()-1));q.setObject(4,id);q.setLong(5,request.version());
          if(q.executeUpdate()!=1)throw new CollectorFailure(409,"BATCH_QUEUE_CONFLICT");
        }
        c.commit();
      }catch(SQLException|RuntimeException e){c.rollback();throw e;}
    }catch(SQLException e){throw database();}
  }
  public Map<String,Integer> counts() {
    try(var c=store.connection();var q=c.createStatement();var r=q.executeQuery("SELECT state,count(*) FROM collect.batch_queue GROUP BY state")) {
      var result=new TreeMap<String,Integer>();while(r.next())result.put(r.getString(1),r.getInt(2));return result;
    }catch(SQLException e){throw database();}
  }
  private static void authorize(ResultSet r,String actor,String channel)throws SQLException {
    if(!actor.equals(r.getString("actor_hmac"))||!channel.equals(r.getString("channel_hmac")))throw new CollectorFailure(403,"LOCAL_FORBIDDEN");
  }
  private static Confirmation confirmation(ResultSet r)throws SQLException{return new Confirmation((UUID)r.getObject("id"),r.getString("source_key"),r.getString("source_post_key"),r.getString("canonical_url"),(UUID)r.getObject("request_id"));}
  private static Request request(ResultSet r)throws SQLException{return new Request((UUID)r.getObject("id"),r.getString("source_key"),r.getString("source_post_key"),r.getString("canonical_url"),r.getString("state"),r.getInt("attempts"),(UUID)r.getObject("active_run_id"),r.getLong("version"));}
}
