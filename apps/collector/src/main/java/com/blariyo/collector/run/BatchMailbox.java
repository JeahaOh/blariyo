package com.blariyo.collector.run;

import com.blariyo.collector.shared.*;
import com.blariyo.collector.source.*;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Duration;
import java.util.*;

/** Pull/validate/enqueue/receipt/ack is one short transaction. This class has no HTTP/object client. */
public final class BatchMailbox {
  private record Lease(UUID id,String source,String url,byte[] canonicalHash,byte[] postHash,int version,UUID token,Timestamp deadline) {}
  private final BatchStore store;
  private final BatchQueueStore queue;
  public BatchMailbox(BatchStore store){this.store=store;this.queue=new BatchQueueStore(store);}
  public int pull(SourceRegistry sources) {
    try(var c=store.connection()) {
      c.setAutoCommit(false);
      try {
        try(var q=c.createStatement();var r=q.executeQuery("SELECT pg_try_advisory_xact_lock_shared(hashtextextended('collect-retention-restore',0))")) {
          r.next();if(!r.getBoolean(1))throw new CollectorFailure(503,"RETENTION_RESTORE_BUSY");
        }
        try(var q=c.createStatement()){q.execute("SELECT collect.cleanup_input_receipts()");}
        var leases=new ArrayList<Lease>();
        try(var q=c.createStatement();var r=q.executeQuery("SELECT * FROM collect.claim_web_requests(20)")) {
          while(r.next())leases.add(new Lease((UUID)r.getObject("request_id"),r.getString("source_key"),r.getString("canonical_url"),
              r.getBytes("canonical_hash"),r.getBytes("post_key_hash"),r.getInt("normalization_version"),(UUID)r.getObject("lease_token"),r.getTimestamp("accept_before")));
        }
        int accepted=0;
        for(var lease:leases) {
          // Never wait for a collecting source while holding its mailbox rows.
          try(var q=c.prepareStatement("SELECT pg_try_advisory_xact_lock(hashtextextended(?,0))")) {
            q.setString(1,"collector-source:"+lease.source());try(var r=q.executeQuery()){r.next();if(!r.getBoolean(1))continue;}
          }
          String state="ACCEPTED",error=null;UUID request=null;
          var validation=c.setSavepoint();
          try {
            try(var q=c.prepareStatement("SELECT collect.web_retry_accessible(?)")) {
              q.setObject(1,lease.id());try(var r=q.executeQuery()){r.next();if(!r.getBoolean(1))throw new CollectorFailure(409,"REQUEST_RETRY_NOT_ALLOWED");}
            }
            if(lease.version()!=1)throw new CollectorFailure(409,"NORMALIZATION_VERSION_MISMATCH");
            var source=store.collectionSource(sources.key(lease.source()));
            if(!BatchSourceRuntime.policy(source).path("enabled").asBoolean())throw new CollectorFailure(403,"SOURCE_DISABLED");
            try(var q=c.prepareStatement("SELECT freshness FROM collect.batch_runtime_projection WHERE source_key=?")) {
              q.setString(1,source.key());try(var r=q.executeQuery()){
                if(!r.next()||!r.getString(1).equals("CURRENT"))throw new CollectorFailure(503,"SOURCE_CONFIG_UNAVAILABLE");
              }
            }
            source.policy().allow(lease.url());var identity=source.adapter().identify(URI.create(lease.url()));
            if(!identity.canonical().toString().equals(lease.url())||!Arrays.equals(hash("v1",lease.url()),lease.canonicalHash())
                ||!Arrays.equals(hash("v1",source.key(),identity.postKey()),lease.postHash()))
              throw new CollectorFailure(409,"NORMALIZATION_VERSION_MISMATCH");
            try(var q=c.prepareStatement("SELECT collect.lookup_dedup(?,?,?)")) {
              q.setString(1,source.key());q.setString(2,identity.postKey());q.setString(3,lease.url());
              try(var r=q.executeQuery()){r.next();if(r.getObject(1)!=null)state="DUPLICATE";}
            }
            if(state.equals("ACCEPTED"))request=queue.enqueue(c,source.key(),identity.postKey(),lease.url(),
                Timestamp.from(lease.deadline().toInstant().minus(Duration.ofHours(24))));
          }catch(CollectorFailure failure){c.rollback(validation);state="BLOCKED";error=failure.getMessage();request=null;}
          catch(SQLException failure){
            if(!"23505".equals(failure.getSQLState())||!failure.getMessage().contains("DEDUP_IDENTITY_CONFLICT"))throw failure;
            c.rollback(validation);state="BLOCKED";error="DEDUP_IDENTITY_CONFLICT";request=null;
          }
          c.releaseSavepoint(validation);
          try(var q=c.prepareStatement("INSERT INTO collect.batch_input_receipt(request_id,queue_id,state,error_code) VALUES(?,?,?,?)")) {
            q.setObject(1,lease.id());q.setObject(2,request);q.setString(3,state);q.setString(4,error);q.executeUpdate();
          }
          try(var q=c.prepareStatement("SELECT collect.ack_web_request(?,?)")){q.setObject(1,lease.id());q.setObject(2,lease.token());q.execute();}
          accepted++;
        }
        c.commit();return accepted;
      }catch(SQLException|RuntimeException error){c.rollback();throw error;}
    }catch(SQLException error){throw new CollectorFailure(503,"BATCH_MAILBOX_DB_FAILED");}
  }
  private static byte[] hash(String... values) {
    try {
      var digest=MessageDigest.getInstance("SHA-256");
      for(String value:values){byte[] bytes=value.getBytes(StandardCharsets.UTF_8);digest.update(ByteBuffer.allocate(4).putInt(bytes.length).array());digest.update(bytes);}
      return digest.digest();
    }catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException("SHA256_UNAVAILABLE",error);}
  }
}
