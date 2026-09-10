package com.blariyo.collector.source;

import org.springframework.context.annotation.*;

@Configuration
public class TransportConfiguration {
  @Bean
  @Profile("!fixture")
  SourceTransport sourceTransport() {
    return new PinnedHttp();
  }
}
