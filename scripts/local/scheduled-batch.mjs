// Invoked once per launchd calendar event. The existing runner owns source policy and local DB credentials.
import {spawn} from 'node:child_process';
import {mkdir, open, readdir, stat, unlink, readFile, writeFile, rename} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {createConnection} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {batchReports, collectWithRecovery} from './batch-schedule-retry.mjs';

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

async function ready() {
  const database = new Promise(resolve => {
    const socket = createConnection({host:'127.0.0.1', port:5439});
    const finish = value => {socket.destroy(); resolve(value);};
    socket.setTimeout(5000, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
  const dns = Promise.any(['theqoo.net', 'www.dogdrip.net'].map(host => lookup(host))).then(() => true, () => false);
  const timeout = AbortSignal.timeout(6000);
  return await Promise.race([
    Promise.all([database, dns]).then(values => values.every(Boolean)),
    new Promise(resolve => timeout.addEventListener('abort', () => resolve(false), {once:true})),
  ]);
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
  const startedAt = new Date().toISOString();
  const logPath = join(logDirectory, `run-${startedAt.replaceAll(':', '-')}.log`);
  const log = await open(logPath, 'wx', 0o600);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const awake = spawn('/usr/bin/caffeinate', ['-is', '-w', String(process.pid)], {stdio:'ignore'});
  awake.on('error', () => controller.abort());
  const statePath = resolve('.local-data/batch-schedule/status.json');
  let attempt = 0;
  try {
    await log.write(`${JSON.stringify({event:'scheduled-batch-started', at:new Date().toISOString(), args:BATCH_ARGS})}\n`);
    const result = await collectWithRecovery({signal:controller.signal, deadline:Date.now() + MAX_RUNTIME_MS,
      ready, wait:(ms, signal) => delay(ms, undefined, {signal}),
      publish:async value => {
        const status = {startedAt, updatedAt:new Date().toISOString(), ...value};
        await writeFile(statePath + '.tmp', JSON.stringify(status, null, 2) + '\n', {mode:0o600});
        await rename(statePath + '.tmp', statePath);
        await log.write(`${JSON.stringify({event:'scheduled-batch-status', ...status})}\n`);
      },
      run:async (sources, timeoutMs) => {
        const attemptPath = logPath.replace('.log', `.${++attempt}.log`);
        const output = await open(attemptPath, 'wx', 0o600);
        let exitCode;
        try {
          const env = {...process.env, COLLECTOR_SOURCE_CONFIG:resolve('apps/collector/ops/reference-sites.sources.example.json')};
          delete env.COLLECTOR_SOURCE_FILTER;
          if (sources) env.COLLECTOR_SOURCE_FILTER = sources.join(',');
          exitCode = await runBatch({stdio:['ignore', output.fd, output.fd], timeoutMs, env});
        } finally { await output.close(); }
        const text = await readFile(attemptPath, 'utf8');
        return {exitCode, reports:batchReports(text)};
      },
    });
    process.exitCode = result.exitCode;
    await log.write(`${JSON.stringify({event:'scheduled-batch-finished', at:new Date().toISOString(), exitCode:process.exitCode})}\n`);
  } catch (error) {
    await writeFile(statePath + '.tmp', JSON.stringify({startedAt, updatedAt:new Date().toISOString(),
      state:'FAILED', exitCode:1, error:'LOCAL_SCHEDULED_BATCH_FAILED'}) + '\n', {mode:0o600});
    await rename(statePath + '.tmp', statePath);
    throw error;
  } finally {
    awake.kill('SIGTERM');
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await log.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {console.error('LOCAL_SCHEDULED_BATCH_FAILED'); process.exitCode = 1;});
}
