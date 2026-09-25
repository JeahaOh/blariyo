import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, realpath } from 'node:fs/promises';
import { hostname, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { git } from './git.mjs';

const taskPattern = /^[A-Z][A-Z0-9]*-\d+$/;
const resourcePattern = /^[a-z0-9][a-z0-9:_-]{0,63}$/;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pythonEnvironment() {
  const allowed = ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TMPDIR', 'TMP', 'TEMP'];
  return Object.fromEntries(
    allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])
  );
}

function pythonCommand() {
  return process.env.HARNESS_PYTHON ?? 'python3';
}

async function stateDirectory(cwd, create = false) {
  if (!['darwin', 'linux', 'win32'].includes(process.platform))
    throw new Error(
      `local leases are unsupported on ${process.platform}; refusing unmanaged fallback`
    );
  const commonDirOutput = git(['rev-parse', '--git-common-dir'], { cwd }).trim();
  const commonDir = await realpath(resolve(cwd, commonDirOutput));
  const repositoryId = hash(commonDir).slice(0, 32);
  const cacheRoot =
    process.env.HARNESS_STATE_ROOT ??
    (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches')
      : process.platform === 'win32'
        ? (process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'))
        : (process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')));
  const directory = join(cacheRoot, 'blariyo-harness', repositoryId, 'leases');
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

function lockNames(taskId, resources) {
  if (!taskPattern.test(taskId)) throw new Error('task ID format is invalid');
  if (!Array.isArray(resources) || resources.some((value) => !resourcePattern.test(value)))
    throw new Error('resource names must be lowercase identifiers (1-64 characters)');
  const uniqueResources = [...new Set(resources)];
  return [`task:${taskId}`, ...uniqueResources.map((resource) => `resource:${resource}`).sort()];
}

function inspectLock(path) {
  const result = spawnSync(
    pythonCommand(),
    [resolve(import.meta.dirname, 'lease_lock.py'), 'inspect', path],
    {
      encoding: 'utf8',
      env: pythonEnvironment(),
      timeout: 5000,
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`lease inspection failed: ${(result.stderr || result.stdout).trim()}`);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('lease inspection returned an invalid record');
  }
}

function acquireLock(path, metadata) {
  const child = spawn(
    pythonCommand(),
    [resolve(import.meta.dirname, 'lease_lock.py'), 'hold', path, JSON.stringify(metadata)],
    { stdio: ['pipe', 'pipe', 'pipe'], env: pythonEnvironment() }
  );
  let output = '';
  let errors = '';
  let settled = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output += chunk;
    const newline = output.indexOf('\n');
    if (newline < 0 || settled) return;
    settled = true;
    let result;
    try {
      result = JSON.parse(output.slice(0, newline));
    } catch {
      rejectReady(new Error(`lease helper returned invalid data: ${errors.trim()}`));
      child.stdin.end();
      return;
    }
    if (result.state !== 'ACQUIRED') {
      rejectReady(new Error(`lease is already held: ${JSON.stringify(result.owner ?? null)}`));
      child.stdin.end();
      return;
    }
    resolveReady({ child, result });
  });
  child.stderr.on('data', (chunk) => {
    errors = `${errors}${chunk}`.slice(-4096);
  });
  child.once('error', (error) => {
    if (!settled) {
      settled = true;
      rejectReady(error);
    }
  });
  child.once('exit', (code) => {
    if (!settled) {
      settled = true;
      rejectReady(
        new Error(`lease helper exited before acquiring the lock (${code}): ${errors.trim()}`)
      );
    }
  });
  return ready;
}

export async function inspectTaskLeases(taskId, resources = [], cwd = process.cwd()) {
  const directory = await stateDirectory(cwd, false);
  const names = lockNames(taskId, resources);
  const locks = names.map((name) => ({
    name,
    ...inspectLock(join(directory, `${hash(name)}.lock`)),
  }));
  return {
    taskId,
    locks,
    available: locks.every((lock) => ['ABSENT', 'AVAILABLE'].includes(lock.state)),
  };
}

export async function acquireTaskLeases(taskId, resources = [], cwd = process.cwd()) {
  const directory = await stateDirectory(cwd, true);
  const names = lockNames(taskId, resources);
  const leaseId = randomUUID();
  const commonDir = await realpath(
    resolve(cwd, git(['rev-parse', '--git-common-dir'], { cwd }).trim())
  );
  const worktreePath = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  const owner = {
    leaseId,
    taskId,
    host: hostname(),
    pid: process.pid,
    worktreePath,
    worktreeId: hash(`${worktreePath}\0${git(['rev-parse', '--git-dir'], { cwd }).trim()}`).slice(
      0,
      16
    ),
    sessionId: process.env.CODEX_SESSION_ID ?? null,
    acquiredAt: new Date().toISOString(),
  };
  const held = [];
  try {
    for (const name of names) {
      const metadata = { ...owner, lockName: name, repositoryId: hash(commonDir).slice(0, 32) };
      const { child, result } = await acquireLock(join(directory, `${hash(name)}.lock`), metadata);
      held.push({ name, child, owner: result.owner });
    }
  } catch (error) {
    await Promise.all(held.map((lock) => releaseLock(lock.child)));
    throw error;
  }
  let released = false;
  return {
    leaseId,
    owner,
    locks: names,
    async release() {
      if (released) return;
      released = true;
      const failures = [];
      for (const lock of [...held].reverse()) {
        try {
          await releaseLock(lock.child);
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length)
        throw new AggregateError(failures, 'one or more task leases failed to release');
    },
  };
}

function releaseLock(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolvePromise, rejectPromise) => {
    child.once('exit', (code) =>
      code === 0
        ? resolvePromise()
        : rejectPromise(new Error(`lease helper exited with status ${code}`))
    );
    child.stdin.end('release\n');
  });
}
