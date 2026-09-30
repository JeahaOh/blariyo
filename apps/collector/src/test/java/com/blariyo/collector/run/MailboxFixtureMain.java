package com.blariyo.collector.run;

import com.blariyo.collector.shared.Json;
import com.blariyo.collector.source.SourceRegistry;
import com.zaxxer.hikari.*;
import java.util.*;

/** Exercises the actual publisher/puller in a new JVM with a restricted test login, without a transport. */
public final class MailboxFixtureMain {
  public static void main(String[] args) {
    if (org.slf4j.LoggerFactory.getLogger("com.zaxxer.hikari") instanceof ch.qos.logback.classic.Logger logger)
      logger.setLevel(ch.qos.logback.classic.Level.WARN);
    var env=System.getenv();String url=env.get("MAILBOX_FIXTURE_JDBC");
    if(url==null||!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:55449/nest_[a-f0-9]{12}"))
      throw new IllegalArgumentException("ISOLATED_MAILBOX_DATABASE_REQUIRED");
    var settings=new HikariConfig();settings.setJdbcUrl(url);settings.setUsername(env.get("MAILBOX_FIXTURE_USER"));
    settings.setPassword("");settings.setMaximumPoolSize(2);
    var sources=new SourceRegistry(Json.parse(env.get("MAILBOX_FIXTURE_SOURCES").getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    try(var db=new HikariDataSource(settings)) {
      var store=new BatchStore(db);
      new BatchSourceRuntime(store,UUID.fromString(env.get("MAILBOX_FIXTURE_INSTANCE"))).publish(sources);
      String crash=env.getOrDefault("MAILBOX_FIXTURE_CRASH","");
      if(!crash.isEmpty())store=new BatchStore(crashDataSource(db,crash));
      int accepted="true".equals(env.get("MAILBOX_FIXTURE_PUBLISH_ONLY"))?0:new BatchMailbox(store).pull(sources);
      System.out.println(Json.tree(Map.of("accepted",accepted,"externalRequests",0)));
    }
  }
  /** Test-only connection decorator: terminate the JVM at the real puller's transaction boundary. */
  private static javax.sql.DataSource crashDataSource(javax.sql.DataSource delegate,String phase) {
    if(!Set.of("BEFORE_ACK","AFTER_ACK","AFTER_COMMIT").contains(phase))throw new IllegalArgumentException("FIXTURE_PHASE_INVALID");
    return proxy(javax.sql.DataSource.class,(method,args)->{
      Object value=invoke(delegate,method,args);
      if(!method.getName().equals("getConnection"))return value;
      var connection=(java.sql.Connection)value;
      return proxy(java.sql.Connection.class,(operation,parameters)->{
        Object result=invoke(connection,operation,parameters);
        if(operation.getName().equals("commit")&&phase.equals("AFTER_COMMIT"))Runtime.getRuntime().halt(77);
        if(operation.getName().equals("prepareStatement")&&parameters[0] instanceof String sql&&sql.startsWith("SELECT collect.ack_web_request")){
          var statement=(java.sql.PreparedStatement)result;
          return proxy(java.sql.PreparedStatement.class,(command,values)->{
            if(command.getName().equals("execute")&&phase.equals("BEFORE_ACK"))Runtime.getRuntime().halt(77);
            Object response=invoke(statement,command,values);
            if(command.getName().equals("execute")&&phase.equals("AFTER_ACK"))Runtime.getRuntime().halt(77);
            return response;
          });
        }
        return result;
      });
    });
  }
  @FunctionalInterface private interface Call {Object run(java.lang.reflect.Method method,Object[] args)throws Throwable;}
  private static <T> T proxy(Class<T> type,Call action){
    return type.cast(java.lang.reflect.Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},
      (object,method,args)->action.run(method,args)));
  }
  private static Object invoke(Object target,java.lang.reflect.Method method,Object[] args)throws Throwable{
    try{return method.invoke(target,args);}catch(java.lang.reflect.InvocationTargetException error){throw error.getCause();}
  }
}
