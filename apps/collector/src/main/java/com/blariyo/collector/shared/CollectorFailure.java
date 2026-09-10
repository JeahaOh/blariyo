package com.blariyo.collector.shared;

public final class CollectorFailure extends RuntimeException {
  private final int status;

  public CollectorFailure(int status, String code) {
    super(code, null, false, false);
    this.status = status;
  }

  public int status() {
    return status;
  }
}
