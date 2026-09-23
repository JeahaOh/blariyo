package com.blariyo.collector.run;

import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.source.SourceMediaLimits;
import com.blariyo.collector.shared.CollectorFailure;
import org.junit.jupiter.api.Test;

class ArticleMediaBudgetTests {
  @Test void remainingBudgetBoundsDownloadBeforeWriteAndIncludesAttachments() {
    var budget = new ArticleMediaBudget(new SourceMediaLimits(200, 8, 10));
    assertEquals(8, budget.requestLimit());
    budget.accept(7);
    assertEquals(4, budget.requestLimit());
    assertTrue(budget.totalIsBinding());
    assertEquals("SOURCE_MEDIA_TOTAL_LIMIT_EXCEEDED", assertThrows(CollectorFailure.class, () -> budget.accept(4)).getMessage());
    budget.accept(3);
    assertThrows(CollectorFailure.class, budget::requestLimit);
    var nextArticle = new ArticleMediaBudget(new SourceMediaLimits(200, 8, 10));
    assertEquals(8, nextArticle.requestLimit());
    assertEquals("SOURCE_TOO_LARGE", assertThrows(CollectorFailure.class, () -> nextArticle.accept(9)).getMessage());
  }
}
