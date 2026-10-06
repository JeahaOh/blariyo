package com.blariyo.collector.run;

import com.blariyo.collector.storage.BatchObjectStore;
import com.zaxxer.hikari.*;
import java.util.Map;

/** Real ownership triggers and role permissions; no source HTTP requests. */
public final class ManualDeleteRoleFixtureMain {
  public static void main(String[] args) {
    var config=new HikariConfig();config.setJdbcUrl(System.getenv("COLLECTOR_DB_URL"));
    config.setUsername(System.getenv("COLLECTOR_DB_USER"));config.setPassword(System.getenv("COLLECTOR_DB_PASSWORD"));config.setMaximumPoolSize(3);
    try(var ds=new HikariDataSource(config)) {
      var store=new BatchStore(ds);var objects=new BatchObjectStore.Local(System.getenv("COLLECTOR_OBJECT_STORE_DIRECTORY"));
      try(var lock=store.lockSource("manualdelete")) {
        var run=store.begin("manualdelete","fixture","WRITE_DB",1,2,10000,null);
        for(String key:new String[]{"delete","preserve"}) {
          var item=store.claim(run,"manualdelete",key,"https://example.invalid/"+key);
          var raw=objects.put("collect/raw/"+run+"/"+item+".html",("raw-"+key).getBytes(),"text/html");
          store.raw(item,raw.objectKey());
          var media=objects.put("collect/media/"+run+"/"+item+"/1",("file-"+key).getBytes(),"application/octet-stream");
          store.media(item,1,"FILE","https://example.invalid/file",media.objectKey(),media.sha256(),media.contentType(),media.bytes());
          store.failItem(run,item,"DETAIL","SOURCE_PARSING_FAILED");
        }
        var report=objects.put("collect/report/"+run+".jsonl","{}\n".getBytes(),"application/x-ndjson");
        store.finish(run,"PARTIAL",Map.of(),report.objectKey(),report.sha256());
      }
      System.out.println("MANUAL_DELETE_FIXTURE_READY");
    }
  }
}
