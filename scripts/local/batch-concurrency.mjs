// Number of source batches running at once, not HTTP requests within a source.
export const DEFAULT_SOURCE_CONCURRENCY = 3;

export function sourceConcurrency(value = process.env.COLLECTOR_SOURCE_CONCURRENCY) {
  if (value === undefined) return DEFAULT_SOURCE_CONCURRENCY;
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('COLLECTOR_SOURCE_CONCURRENCY must be a positive integer');
  }
  return Number(value);
}

export async function runSourcePool(sources, concurrency, run, signal) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error('INVALID_SOURCE_CONCURRENCY');
  }
  const queue = [...new Set(sources)];
  const results = [];
  await Promise.all(Array.from({length: Math.min(concurrency, queue.length)}, async () => {
    while (queue.length && !signal?.aborted) {
      const source = queue.shift();
      let exitCode;
      try { exitCode = await run(source); }
      catch { exitCode = 1; }
      results.push({source, exitCode});
    }
  }));
  return results;
}
