package com.blariyo.collector.shared;

import java.net.URI;
import java.util.*;

public final class CollectorFailure extends RuntimeException {
  private final int status;
  private final Map<String,Object> details;

  public CollectorFailure(int status, String code) {
    this(status, code, Map.of());
  }

  private CollectorFailure(int status, String code, Map<String,Object> details) {
    super(code, null, false, false);
    this.status = status;
    this.details = Map.copyOf(details);
  }

  /** Only fixed diagnostic codes, a hostname and a numeric status; never raw exception/URL/body. */
  public CollectorFailure diagnostic(String reason, URI request, Integer httpStatus) {
    var safe = new LinkedHashMap<>(details);
    if (reason != null && REASONS.contains(reason)) safe.putIfAbsent("diagnosticReason", reason);
    if (request != null && request.getHost() != null) {
      String host = request.getHost().toLowerCase(Locale.ROOT);
      if (host.length() <= 253 && host.matches("[a-z0-9.-]+")) safe.putIfAbsent("requestHost", host);
    }
    if (httpStatus != null && httpStatus >= 100 && httpStatus <= 599) safe.putIfAbsent("httpStatus", httpStatus);
    return new CollectorFailure(status, getMessage(), safe);
  }

  public Map<String,Object> details() { return details; }

  private static final Set<String> REASONS = Set.of(
      "UNAPPROVED_SOURCE", "CONFIG_BLOCKED", "INVALID_URL", "SCHEME_NOT_ALLOWED", "HOST_NOT_ALLOWED",
      "PATH_NOT_ALLOWED", "PORT_NOT_ALLOWED", "URL_CREDENTIALS_NOT_ALLOWED", "URL_FRAGMENT_NOT_ALLOWED",
      "NON_PUBLIC_IP", "DNS_EMPTY", "DNS_LOOKUP_FAILED", "TLS_ERROR", "TIMEOUT", "CONNECTION_ERROR",
      "NETWORK_INTERRUPTED", "HTTP_ACCESS_DENIED", "HTTP_REJECTED", "HTTP_RETRY_EXHAUSTED", "HTTP_RATE_LIMITED",
      "ACCESS_CHALLENGE", "PARSER_REJECTED", "CHART_UNVERIFIED", "REDIRECT_LIMIT", "REDIRECT_HOST_NOT_ALLOWED",
      "REDIRECT_MISSING_LOCATION", "REDIRECT_LOOP", "BODY_TOO_LARGE", "ENCODING_UNSUPPORTED");

  public int status() {
    return status;
  }
}
