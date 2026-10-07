import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { checksFor, excludedInputs, unsupportedScopes } from './policy.ts';
import type { Check } from './policy.ts';
import { assess, classify, hash, parseCounts, runtimeVersions, snapshot } from './receipt.ts';
import type { Receipt, Result } from './receipt.ts';

export function notRun(check: Check): Result {
  return { ...check, startedAt: null, finishedAt: null, exitCode: null,
    state: 'not_run', reason: 'not-started', counts: null, outputHash: hash(''), outputBytes: 0 };
}

// Report only source locations from Node's failure section, never test titles,
// assertion values, URLs or raw logs that may contain credentials.
export function failureLocations(output: string): string[] {
  return [...new Set(Array.from(output.matchAll(
    /^test at ((?:tests|apps|scripts)\/[A-Za-z0-9_./-]+\.[cm]?[jt]s:\d+:\d+)\s*$/gm),
    match => match[1] ?? '').filter(Boolean))];
}

export async function runCheck(root: string, check: Check, signal?: AbortSignal): Promise<Result> {
  if (signal?.aborted) return notRun(check);
  const startedAt = new Date().toISOString();
  return new Promise(resolveResult => {
    const child = spawn(check.command === 'node' ? process.execPath : check.command, check.args, {
      cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const digest = createHash('sha256');
    let outputBytes = 0, output = '', reason = 'completed';
    const capture = (chunk: Buffer) => {
      outputBytes += chunk.length; digest.update(chunk);
      if (outputBytes <= 8 * 1024 * 1024) output += chunk.toString('utf8');
      else reason = 'output-limit';
    };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      reason = 'interrupted';
      if (!child.pid) return;
      const kill = (kind: NodeJS.Signals) => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, kind);
          else child.kill(kind);
        } catch { /* The owned process already exited. */ }
      };
      kill('SIGTERM'); forceKill = setTimeout(() => kill('SIGKILL'), 3000);
      forceKill.unref();
    };
    signal?.addEventListener('abort', stop, { once: true });
    const timeout = setTimeout(stop, 30 * 60 * 1000);
    child.on('error', () => { reason = 'spawn-error'; });
    child.on('close', (exitCode) => {
      clearTimeout(timeout); if (forceKill) clearTimeout(forceKill);
      signal?.removeEventListener('abort', stop);
      const counts = parseCounts(output, check.parser);
      const state = reason === 'completed' ? classify(exitCode, check.parser, counts) : 'unknown';
      if (state === 'fail')
        for (const location of failureLocations(output)) console.error(`QUALITY_FAILURE_AT ${location}`);
      resolveResult({ ...check, startedAt, finishedAt: new Date().toISOString(), exitCode,
        state, reason, counts, outputHash: digest.digest('hex'), outputBytes });
    });
  });
}

export function evidenceDirectory(root: string, task: string): string {
  if (!/^worklog\/\d{4}-\d{2}-\d{2}\/[a-z0-9][a-z0-9-]*$/.test(task)) throw new Error('INVALID_TASK_PATH');
  const directory = resolve(root, task, 'verification');
  // Create one component at a time and reject symlink escapes before writing.
  let parent = realpathSync(root);
  for (const part of `${task}/verification`.split('/')) {
    const next = resolve(parent, part);
    mkdirSync(next, { recursive: true });
    const real = realpathSync(next);
    if (real !== next || !real.startsWith(realpathSync(root) + sep)) throw new Error('UNSAFE_OUTPUT_PATH');
    parent = real;
  }
  return directory;
}

export async function verify(root: string, profile: string, task: string, signal?: AbortSignal): Promise<{ file: string; problems: string[] }> {
  const checks = checksFor(profile), directory = evidenceDirectory(root, task);
  const startedAt = new Date().toISOString();
  const start = snapshot(root), results = checks.map(notRun);
  const versions = runtimeVersions(root);
  const file = resolve(directory, `${startedAt.replaceAll(':', '-')}-${profile}-${process.pid}.json`);
  const receipt: Receipt = { schema: 1, profile, root: realpathSync(root), startedAt, completed: false,
    finishedAt: startedAt, versions,
    exclusions: excludedInputs, start, end: start, results, unsupported: unsupportedScopes };
  writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const checkpoint = () => {
    receipt.finishedAt = new Date().toISOString();
    writeFileSync(file + '.part', JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    renameSync(file + '.part', file);
  };
  for (const [index, check] of checks.entries()) {
    console.log(`QUALITY_START ${check.id}`);
    const result = await runCheck(root, check, signal);
    results[index] = result;
    checkpoint();
    console.log(`QUALITY_RESULT ${result.id} ${result.state} exit=${String(result.exitCode)}`);
  }
  receipt.end = snapshot(root); receipt.completed = true; checkpoint();
  const problems = assess(receipt, snapshot(root), checks, root, runtimeVersions(root));
  return { file, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { profile: { type: 'string', default: 'quality' }, task: { type: 'string' } } });
    if (!values.task) throw new Error('TASK_REQUIRED');
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    const result = await verify(root, values.profile, values.task, controller.signal);
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    console.log(JSON.stringify(result)); process.exitCode = result.problems.length ? 1 : 0;
  } catch {
    console.error('QUALITY_EXECUTION_INCOMPLETE'); process.exitCode = 2;
  }
}
