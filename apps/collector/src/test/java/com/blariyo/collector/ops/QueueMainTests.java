package com.blariyo.collector.ops;
import static org.junit.jupiter.api.Assertions.*;
import com.blariyo.collector.shared.CollectorFailure;
import org.junit.jupiter.api.Test;
class QueueMainTests {
  @Test void explicitWriteModeAndValidOptionsAreRequiredBeforeAnyConnection() {
    for(String[] args:new String[][]{{"queue"},{"queue","--dry-run"},{"queue","--write-db","--write-db"},{"discord","--once","--write-db"},{"queue","--unknown"}})
      assertThrows(CollectorFailure.class,()->QueueMain.execute(args));
  }
}
