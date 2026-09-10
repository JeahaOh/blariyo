package com.blariyo.collector.bootstrap;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.core.CoreClient;
import com.blariyo.collector.run.RunRepository;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.spool.EncryptedSpool;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public final class StartupChecks implements ApplicationRunner {
  private final RunRepository runs;
  private final Secrets secrets;
  private final CoreClient core;
  private final EncryptedSpool spool;

  public StartupChecks(RunRepository runs, Secrets secrets, CoreClient core, EncryptedSpool spool) {
    this.runs = runs;
    this.secrets = secrets;
    this.core = core;
    this.spool = spool;
  }

  @Override
  public void run(ApplicationArguments args) {
    String id = core.collectorId();
    secrets.key("spool-key");
    secrets.key("request-key");
    runs.jdbc()
        .update(
            "INSERT INTO collector.identity(singleton,collector_id) VALUES(true,?) ON"
                + " CONFLICT(singleton) DO NOTHING",
            id);
    if (!id.equals(
        runs.jdbc()
            .queryForObject(
                "SELECT collector_id FROM collector.identity WHERE singleton", String.class)))
      throw new CollectorFailure(503, "COLLECTOR_ID_MISMATCH");
    for (String scope :
        java.util.List.of("local-run-token", "local-read-token", "local-stop-token")) {
      String token = secrets.require(scope);
      if (token.length() < 32) throw new CollectorFailure(503, "TOKEN_INVALID");
      runs.jdbc()
          .update(
              "INSERT INTO collector.token_audit(scope,token_hmac) VALUES(?,?) ON CONFLICT(scope)"
                  + " DO UPDATE SET token_hmac=EXCLUDED.token_hmac,rotated_at=CASE WHEN"
                  + " collector.token_audit.token_hmac<>EXCLUDED.token_hmac THEN now() ELSE"
                  + " collector.token_audit.rotated_at END",
              scope,
              secrets.hmac(token));
    }
    var ref = spool.put(new byte[] {1});
    spool.get(ref);
    spool.delete(ref);
    runs.markReady();
  }
}
