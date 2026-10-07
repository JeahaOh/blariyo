package com.blariyo.collector.discordreview;
/** Safe machine code only. Never retain an upstream response, URL, credential or body. */
public final class ReviewFailure extends RuntimeException {
  public final String code;
  public final boolean blocked;
  public final long retryAfterMs;
  public ReviewFailure(String code) { this(code, false, 0); }
  public ReviewFailure(String code, boolean blocked, long retryAfterMs) {
    super(code); this.code=code; this.blocked=blocked; this.retryAfterMs=retryAfterMs;
  }
}
