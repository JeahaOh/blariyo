package com.blariyo.collector.run;

import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Restricted batch login exercises all new security-definer entry points. */
public final class ImageFailureRoleFixtureMain {
  public static void main(String[] args) {
    var config=new HikariConfig();config.setJdbcUrl(System.getenv("COLLECTOR_DB_URL"));
    config.setUsername(System.getenv("COLLECTOR_DB_USER"));config.setPassword(System.getenv("COLLECTOR_DB_PASSWORD"));config.setMaximumPoolSize(3);
    try(var ds=new HikariDataSource(config)) {
      var store=TestSourceControls.store(ds);var calls=new AtomicInteger();
      var objects=new BatchObjectStore.Local(System.getenv("COLLECTOR_OBJECT_STORE_DIRECTORY"));
      var options=new DirectUrlRunner.Options("theqoo","https://theqoo.net/hot/987654321012345",10000,true);
      var report=new DirectUrlRunner(ImageFailureReadbackTests.network(calls,100),store,objects,ignored->{})
          .run(ImageFailureReadbackTests.source(),options);
      if(report.failures()!=1||calls.get()!=2||!report.errors().contains("IMAGE_RETRY_EXHAUSTED"))throw new IllegalStateException("ROLE_IMAGE_RETRY_FAILED");
      var duplicate=new DirectUrlRunner(ImageFailureReadbackTests.network(calls,0),store,objects,ignored->{})
          .run(ImageFailureReadbackTests.source(),options);
      if(duplicate.duplicates()!=1||calls.get()!=2)throw new IllegalStateException("ROLE_IMAGE_DEDUP_FAILED");
      System.out.println("ROLE_IMAGE_RETRY_PASS");
    }
  }
}
