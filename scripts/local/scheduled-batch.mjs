// Invoked once per launchd calendar event. The existing runner owns source policy and local DB credentials.
import {spawn} from 'node:child_process';
import {mkdir, open, readdir, stat, unlink} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const BATCH_ARGS = ['--write-db', '--max-pages', '2', '--max-items', '20', '--since', '24h'];
export const MAX_RUNTIME_MS = 2 * 60 * 60 * 1000;
const LOG_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export async function runBatch({command = process.execPath, args = ['scripts/local/run-batches.mjs', ...BATCH_ARGS],
  stdio = 'inherit', timeoutMs = MAX_RUNTIME_MS, graceMs = 30_000, env = process.env} = {}) {
  const child = spawn(command, args, {stdio, env, detached:true});
  let forcedCode;
  let escalation;
  const signalGroup = signal => {
    try { process.kill(-child.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const stop = (signal, code) => {
    if (forcedCode !== undefined) return;
    forcedCode = code;
    if (!child.pid) return;
    signalGroup(signal);
    escalation = setTimeout(() => signalGroup('SIGKILL'), graceMs);
  };
  const onInt = () => stop('SIGINT', 130);
  const onTerm = () => stop('SIGTERM', 143);
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  const timeout = setTimeout(() => stop('SIGTERM', 124), timeoutMs);
  try {
    return await new Promise((yes, no) => {
      child.once('error', no);
      child.once('close', code => yes(forcedCode ?? code ?? 1));
    });
  } finally {
    clearTimeout(timeout);
    clearTimeout(escalation);
    process.removeListener('SIGINT', onInt);
    process.removeListener('SIGTERM', onTerm);
  }
}

async function main() {
  process.umask(0o077);
  process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Seoul') throw new Error('LOCAL_TIMEZONE_MUST_BE_ASIA_SEOUL');
  const logDirectory = resolve('.local-data/batch-schedule/logs');
  await mkdir(logDirectory, {recursive:true, mode:0o700});
  for (const name of await readdir(logDirectory)) {
    if (!/^run-[0-9TZ.-]+\.log$/.test(name)) continue;
    const path = join(logDirectory, name);
    if (Date.now() - (await stat(path)).mtimeMs > LOG_RETENTION_MS) await unlink(path);
  }
  const log = await open(join(logDirectory, `run-${new Date().toISOString().replaceAll(':', '-')}.log`), 'wx', 0o600);
  try {
    await log.write(`${JSON.stringify({event:'scheduled-batch-started', at:new Date().toISOString(), args:BATCH_ARGS})}\n`);
    process.exitCode = await runBatch({stdio:['ignore', log.fd, log.fd], env:{...process.env,
      COLLECTOR_SOURCE_CONFIG:resolve('apps/collector/ops/reference-sites.sources.example.json')}});
    await log.write(`${JSON.stringify({event:'scheduled-batch-finished', at:new Date().toISOString(), exitCode:process.exitCode})}\n`);
  } finally {
    await log.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {console.error('LOCAL_SCHEDULED_BATCH_FAILED'); process.exitCode = 1;});
}
