package com.blariyo.collector.source;

import java.net.*;

public interface SourceTransport {
  void validate(URI uri);

  PinnedHttp.Response get(URI uri, int maximum, String userAgent);
}
