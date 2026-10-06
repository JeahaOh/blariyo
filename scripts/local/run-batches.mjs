// Run every registered source through the existing fixed-local-DB batch command.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {DEFAULT_SOURCE_CONCURRENCY, sourceConcurrency, runSourcePool} from './batch-concurrency.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Usage: node scripts/local/run-batches.mjs (--dry-run | --write-db) [--chart NAME] [--max-pages N] [--max-items N] [--since 24h] [--interval-ms N]\nCOLLECTOR_SOURCE_CONCURRENCY: simultaneous source batches (default ${DEFAULT_SOURCE_CONCURRENCY}).\nCOLLECTOR_SOURCE_CONFIG: source JSON file (same setting as run-batch.mjs).\n--dry-run still fetches remote content; it is not an offline preview.`);
} else {
  const controller = new AbortController();
  const children = new Set();
  let interruptedCode;
  const interrupt = (signal) => {
    interruptedCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort();
    for (const child of children) child.kill(signal);
  };
  const onInt = () => interrupt('SIGINT');
  const onTerm = () => interrupt('SIGTERM');
  try {
    const concurrency = sourceConcurrency();
    const values = new Set(['--chart', '--max-pages', '--max-items', '--since', '--interval-ms']);
    const seen = new Set();
    for (let i = 0; i < args.length; i++) {
      const key = args[i];
      if (seen.has(key)) throw new Error('BATCH_OPTIONS_INVALID');
      seen.add(key);
      if (key === '--dry-run' || key === '--write-db') continue;
      if (!values.has(key) || !args[++i] || args[i].startsWith('--')) throw new Error('BATCH_OPTIONS_INVALID');
    }
    if (Number(seen.has('--dry-run')) + Number(seen.has('--write-db')) !== 1) throw new Error('BATCH_MODE_REQUIRED');
    const sourcePath = resolve(process.env.COLLECTOR_SOURCE_CONFIG ?? 'apps/collector/ops/reference-sites.sources.example.json');
    const config = JSON.parse(await readFile(sourcePath, 'utf8'));
    if (!config || Array.isArray(config) || typeof config !== 'object' || !Object.keys(config).length) throw new Error('SOURCE_CONFIG_INVALID');
    const sources = Object.keys(config);
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    console.log(JSON.stringify({event:'batch-pool-started', sources:sources.length, concurrency:Math.min(concurrency, sources.length)}));
    const results = await runSourcePool(sources, concurrency, source => new Promise((yes, no) => {
      console.log(JSON.stringify({event:'source-started', source}));
      const child = spawn(process.execPath, ['scripts/local/run-batch.mjs', 'batch', '--source', source, ...args], {
        stdio:'inherit', env:{...process.env, COLLECTOR_SOURCE_CONFIG:sourcePath},
      });
      children.add(child);
      child.once('error', () => { children.delete(child); no(new Error('BATCH_START_FAILED')); });
      child.once('close', code => {
        children.delete(child);
        const exitCode = code ?? 1;
        console.log(JSON.stringify({event:'source-finished', source, exitCode}));
        yes(exitCode);
      });
    }), controller.signal);
    console.log(JSON.stringify({event:'batch-pool-finished', results, interrupted:controller.signal.aborted}));
    process.exitCode = interruptedCode ?? (results.some(result => result.exitCode !== 0) ? 1 : 0);
  } catch (error) {
    // Only known validation messages are printed; config paths/contents may be private.
    const message = error instanceof Error ? error.message : '';
    console.error(['BATCH_OPTIONS_INVALID','BATCH_MODE_REQUIRED','SOURCE_CONFIG_INVALID','COLLECTOR_SOURCE_CONCURRENCY must be a positive integer'].includes(message) ? message : 'LOCAL_BATCH_POOL_FAILED');
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', onInt);
    process.removeListener('SIGTERM', onTerm);
  }
}
