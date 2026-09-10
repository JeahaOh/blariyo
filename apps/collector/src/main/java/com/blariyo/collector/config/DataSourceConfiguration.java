package com.blariyo.collector.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.util.Arrays;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class DataSourceConfiguration {
  @Bean
  DataSource dataSource(Environment env, Secrets secrets) {
    var config = new HikariConfig();
    config.setJdbcUrl(env.getRequiredProperty("spring.datasource.url"));
    config.setUsername(env.getProperty("spring.datasource.username", "collector"));
    config.setPassword(
        Arrays.asList(env.getActiveProfiles()).contains("fixture")
            ? env.getProperty("spring.datasource.password", "")
            : secrets.require("database-password"));
    config.setMaximumPoolSize(5);
    config.setMinimumIdle(1);
    config.setConnectionTimeout(5000);
    config.setInitializationFailTimeout(5000);
    config.setConnectionInitSql("SET TIME ZONE 'UTC'");
    config.addDataSourceProperty(
        "options",
        "-c statement_timeout=30000 -c lock_timeout=5000 -c"
            + " idle_in_transaction_session_timeout=30000");
    return new HikariDataSource(config);
  }
}
