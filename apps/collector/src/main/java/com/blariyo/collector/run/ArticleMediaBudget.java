package com.blariyo.collector.run;

import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.source.SourceMediaLimits;

/** Count every downloaded image and attachment before any object write. */
final class ArticleMediaBudget {
  private final SourceMediaLimits limits;
  private int used;
  ArticleMediaBudget(SourceMediaLimits limits) { this.limits = limits; }
  int requestLimit() {
    if (used >= limits.maxTotalBytes()) throw new CollectorFailure(413, "SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED");
    // One extra byte distinguishes total-budget overflow from an individually oversized file.
    return Math.min(limits.maxFileBytes(), limits.maxTotalBytes() - used + 1);
  }
  boolean totalIsBinding() { return limits.maxTotalBytes() - used < limits.maxFileBytes(); }
  void accept(int bytes) {
    if (bytes < 0 || bytes > limits.maxFileBytes()) throw new CollectorFailure(413, "SOURCE_TOO_LARGE");
    if (bytes > limits.maxTotalBytes() - used) throw new CollectorFailure(413, "SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED");
    used += bytes;
  }
}
