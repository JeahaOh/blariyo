package com.blariyo.collector.state;

import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import com.blariyo.collector.spool.EncryptedSpool;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.node.ObjectNode;

@Component
public final class StateStore {
  private final RunRepository repository;
  private final EncryptedSpool spool;
  private final TransactionTemplate tx;

  public StateStore(
      RunRepository repository, EncryptedSpool spool, PlatformTransactionManager manager) {
    this.repository = repository;
    this.spool = spool;
    this.tx = new TransactionTemplate(manager);
  }

  public ObjectNode read(UUID id) {
    var row = repository.get(id);
    UUID ref = (UUID) row.get("spool_ref");
    if (ref == null) return Json.MAPPER.createObjectNode();
    byte[] bytes = spool.get(ref);
    if (!Json.sha(bytes).equals(row.get("spool_sha256")))
      throw new CollectorFailure(409, "RECONCILE_REQUIRED");
    return (ObjectNode) Json.parse(bytes);
  }

  public void save(UUID id, ObjectNode state) {
    byte[] bytes = Json.bytes(state);
    UUID fresh = spool.put(bytes);
    String hash = Json.sha(bytes);
    UUID old = (UUID) repository.get(id).get("spool_ref");
    tx.executeWithoutResult(
        status -> {
          repository
              .jdbc()
              .update(
                  "INSERT INTO collector.spool_reference(ref,job_request_id,kind,sha256,expires_at)"
                      + " SELECT ?,?,'STATE',?,expires_at FROM collector.run WHERE id=?",
                  fresh,
                  id,
                  hash,
                  id);
          repository
              .jdbc()
              .update(
                  "UPDATE collector.run SET spool_ref=?,spool_sha256=? WHERE id=?",
                  fresh,
                  hash,
                  id);
          if (old != null)
            repository.jdbc().update("DELETE FROM collector.spool_reference WHERE ref=?", old);
        });
    if (old != null) spool.delete(old);
  }

  public UUID image(UUID id, byte[] bytes) {
    UUID ref = spool.put(bytes);
    repository
        .jdbc()
        .update(
            "INSERT INTO collector.spool_reference(ref,job_request_id,kind,sha256,expires_at)"
                + " VALUES(?,?,'IMAGE',?,now()+interval '24 hours')",
            ref,
            id,
            Json.sha(bytes));
    return ref;
  }

  public byte[] image(UUID ref) {
    var rows =
        repository
            .jdbc()
            .queryForList(
                "SELECT sha256 FROM collector.spool_reference WHERE ref=? AND expires_at>now()",
                ref);
    if (rows.isEmpty()) throw new CollectorFailure(409, "RECONCILE_REQUIRED");
    byte[] bytes = spool.get(ref);
    if (!Json.sha(bytes).equals(rows.getFirst().get("sha256")))
      throw new CollectorFailure(409, "RECONCILE_REQUIRED");
    return bytes;
  }

  public void discard(UUID ref) {
    spool.delete(ref);
    repository.jdbc().update("DELETE FROM collector.spool_reference WHERE ref=?", ref);
  }

  public void clear(UUID id) {
    for (var row :
        repository
            .jdbc()
            .queryForList("SELECT ref FROM collector.spool_reference WHERE job_request_id=?", id))
      discard((UUID) row.get("ref"));
    repository
        .jdbc()
        .update("UPDATE collector.run SET spool_ref=NULL,spool_sha256=NULL WHERE id=?", id);
  }
}
