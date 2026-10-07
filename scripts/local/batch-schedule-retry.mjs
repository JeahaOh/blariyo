export const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000];
export const READINESS_POLL_MS = 60_000;
const TRANSIENT_ERRORS = new Set(['SOURCE_DNS_FAILED', 'SOURCE_FETCH_FAILED', 'SOURCE_HTTP_UNAVAILABLE']);

export function batchReports(text) {
  const reports = new Map();
  for (const line of text.split('\n')) {
    try {
      const report = JSON.parse(line).report;
      if (report && typeof report.source === 'string' && Array.isArray(report.errors)) reports.set(report.source, report);
    } catch { /* Java diagnostics are not report records. */ }
  }
  return [...reports.values()];
}

export function retrySources(reports) {
  return reports.filter(report => ['FAILED', 'PARTIAL'].includes(report.state) &&
    report.errors.some(error => TRANSIENT_ERRORS.has(error)) &&
    report.errors.every(error => TRANSIENT_ERRORS.has(error))).map(report => report.source);
}

// One deadline includes readiness waits, retries and collection. Dependencies allow offline failure/recovery tests.
export async function collectWithRecovery({run, ready, wait, publish, signal, deadline,
  now = Date.now, retryDelays = RETRY_DELAYS_MS, readinessPoll = READINESS_POLL_MS}) {
  const attempts = [];
  let sources;
  const finish = async (state, exitCode) => {
    const value = {state, exitCode, attempts};
    await publish(value);
    return value;
  };
  try {
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      while (true) {
        if (signal.aborted) return await finish('CANCELLED', 143);
        if (now() >= deadline) return await finish('TIMED_OUT', 124);
        if (await ready()) break;
        await publish({state:'WAITING_FOR_NETWORK_OR_DB', attempts});
        await wait(Math.min(readinessPoll, deadline - now()), signal);
      }
      if (signal.aborted) return await finish('CANCELLED', 143);
      if (now() >= deadline) return await finish('TIMED_OUT', 124);
      await publish({state:'RUNNING', attempt:attempt + 1, sources:sources ?? 'active', attempts});
      if (signal.aborted) return await finish('CANCELLED', 143);
      const result = await run(sources, deadline - now());
      attempts.push(result);
      if (signal.aborted || [130, 143].includes(result.exitCode)) return await finish('CANCELLED', result.exitCode);
      if (result.exitCode === 124) return await finish('TIMED_OUT', 124);
      sources = retrySources(result.reports);
      if (!sources.length || attempt === retryDelays.length) {
        const latest = new Map(attempts.flatMap(value => value.reports).map(report => [report.source, report]));
        const incomplete = [...latest.values()].some(report => report.state !== 'COMPLETED');
        const missingReport = attempts.some(value => !value.reports.length ||
          (value.exitCode !== 0 && value.reports.every(report => report.state === 'COMPLETED')));
        return await finish(incomplete || missingReport ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', incomplete || missingReport ? 1 : 0);
      }
      await publish({state:'WAITING_TO_RETRY', sources, delayMs:retryDelays[attempt], attempts});
      await wait(Math.min(retryDelays[attempt], Math.max(0, deadline - now())), signal);
    }
  } catch (error) {
    if (signal.aborted) return await finish('CANCELLED', 143);
    throw error;
  }
}
