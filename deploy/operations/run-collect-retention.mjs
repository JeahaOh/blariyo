import { spawn } from 'node:child_process';
import { readFile, lstat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Incidents } from '../backup/incidents.mjs';

/** The child owns DB/object work. Notification failures never repeat a purge or change its result. */
export async function executeRetention({ executable, args, env, incidents, timeout = 180000 }) {
  if (!executable.startsWith('/') || !Array.isArray(args) || args.some(a => !['--once', '--write-db', '--dry-run', '--restore-inventory'].includes(a)))
    throw Error('RETENTION_WRAPPER_OPTIONS_INVALID');
  let output = '', code = 'RETENTION_FAILED', oversized = false;
  const child = spawn(executable, ['retention', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout, killSignal: 'SIGKILL' });
  child.stdout.on('data', chunk => { if (output.length + chunk.length > 16384) oversized = true; else output += chunk.toString('utf8'); });
  child.stderr.on('data', chunk => {
    const match = /BATCH_RETENTION_FAILED code=([A-Z][A-Z0-9_]{1,79})(?:\s|$)/.exec(chunk.toString('utf8'));
    if (match) code = match[1];
  });
  const exit = await new Promise(yes => { child.once('error', () => yes(-1)); child.once('close', status => yes(status ?? -1)); });
  let result;
  try { result = JSON.parse(output.trim().split('\n').at(-1)); } catch { /* Never print raw process output. */ }
  if (args.includes('--dry-run')) {
    if (exit || oversized || result?.mode !== 'DRY_RUN' || !Number.isSafeInteger(result.due) || !Number.isSafeInteger(result.failed) || typeof result.backupGate !== 'boolean')
      throw Error('RETENTION_DRY_RUN_FAILED');
    return { mode: 'DRY_RUN', due: result.due, failed: result.failed, backupGate: result.backupGate };
  }
  const succeeded = exit === 0 && !oversized && Number.isSafeInteger(result?.purged) && result.purged >= 0 && result.failed === 0;
  let notification = { pending: null, errorCode: 'ALERT_NOT_CONFIGURED' };
  if (incidents) {
    try { notification = await incidents.observe({ job: 'COLLECT_RETENTION', stage: 'PURGE', errorCode: succeeded ? null : code }); }
    catch { notification = { pending: null, errorCode: 'ALERT_STATE_FAILED' }; }
  }
  return { state: succeeded ? 'PURGED_VERIFIED' : 'FAILED', purged: succeeded ? result.purged : null,
    errorCode: succeeded ? null : code, notification };
}

async function main() {
  const env = process.env, stateRoot = env.COLLECTOR_RETENTION_ALERT_STATE_DIR;
  if (!stateRoot || !stateRoot.startsWith('/')) throw Error('RETENTION_ALERT_STATE_REQUIRED');
  await mkdir(stateRoot, { recursive: true, mode: 0o700 });
  const info = await lstat(stateRoot);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw Error('RETENTION_ALERT_STATE_PERMISSIONS');
  let webhook;
  if (env.COLLECTOR_RETENTION_DISCORD_WEBHOOK_FILE) {
    const path = env.COLLECTOR_RETENTION_DISCORD_WEBHOOK_FILE, secret = await lstat(path);
    if (!secret.isFile() || secret.isSymbolicLink() || (secret.mode & 0o077)) throw Error('RETENTION_ALERT_SECRET_PERMISSIONS');
    webhook = (await readFile(path, 'utf8')).trim();
  }
  const incidents = new Incidents({ path: resolve(stateRoot, 'incidents.json'), webhook });
  const result = await executeRetention({ executable: env.COLLECTOR_RETENTION_EXECUTABLE || '/opt/blariyo/current/bin/blariyo-collector',
    args: process.argv.slice(2), env, incidents });
  console.log(JSON.stringify(result)); if (result.state === 'FAILED') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main().catch(() => {
  console.error('RETENTION_WRAPPER_FAILED'); process.exitCode = 1;
});
