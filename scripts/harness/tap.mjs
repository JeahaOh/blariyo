export function parseTapSummary(output) {
  const tests = /^# tests (\d+)$/m.exec(output)?.[1];
  const passed = /^# pass (\d+)$/m.exec(output)?.[1];
  const failed = /^# fail (\d+)$/m.exec(output)?.[1];
  const skipped = /^# skipped (\d+)$/m.exec(output)?.[1];
  if ([tests, passed, failed, skipped].some((value) => value === undefined))
    throw new Error('Node test runner did not produce a complete TAP summary');
  return {
    tests: Number(tests),
    passed: Number(passed),
    failed: Number(failed),
    skipped: Number(skipped),
  };
}

export function validateTapSummary(output) {
  const summary = parseTapSummary(output);
  if (summary.tests < 1 || summary.passed < 1 || summary.failed !== 0 || summary.skipped !== 0)
    throw new Error(`harness test summary is not acceptable: ${JSON.stringify(summary)}`);
  return summary;
}
