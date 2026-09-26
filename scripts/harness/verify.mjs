import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, readlink, realpath, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { git, gitTry } from './git.mjs';
import { acquireTaskLeases, inspectTaskLeases } from './leases.mjs';

const safeCommands = new Set([
  'test:harness',
  'test:quality',
  'lint:harness',
  'lint:all',
  'test:architecture',
]);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function rootFor(cwd) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).trim();
}

async function readPolicyAndTask(root, taskId) {
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(taskId)) throw new Error('task ID format is invalid');
  const rootReal = await realpath(root);
  const policyPath = resolve(root, '.harness/policy.json');
  const policyStat = await lstat(policyPath);
  if (policyStat.isSymbolicLink() || !policyStat.isFile())
    throw new Error('harness policy must be a regular file inside the repository');
  const policyText = await readFile(policyPath, 'utf8');
  const policy = JSON.parse(policyText);
  if (policy.taskManifestDirectory !== '.harness/tasks')
    throw new Error('task manifest directory must be .harness/tasks');
  const taskDirectory = resolve(root, '.harness/tasks');
  const taskDirectoryReal = await realpath(taskDirectory);
  const relativeTaskDirectory = relative(rootReal, taskDirectoryReal);
  if (
    relativeTaskDirectory.startsWith('..') ||
    resolve(rootReal, relativeTaskDirectory) !== taskDirectoryReal
  )
    throw new Error('task manifest directory escapes the repository');
  const taskPath = resolve(taskDirectory, `${taskId}.json`);
  const taskStat = await lstat(taskPath);
  if (taskStat.isSymbolicLink() || !taskStat.isFile())
    throw new Error('task manifest must be a regular file');
  const taskReal = await realpath(taskPath);
  if (dirname(taskReal) !== taskDirectoryReal)
    throw new Error('task manifest escapes its registry directory');
  const taskText = await readFile(taskReal, 'utf8');
  const task = JSON.parse(taskText);
  if (task.taskId !== taskId || !['active', 'in-progress'].includes(task.state))
    throw new Error(`task ${taskId} is mismatched or inactive`);
  if (!Array.isArray(task.verification) || task.verification.length === 0)
    throw new Error(`task ${taskId} has no verification commands`);
  if (task.resources !== undefined && !Array.isArray(task.resources))
    throw new Error(`task ${taskId} resources must be an array`);
  if (task.verification.some((command) => !safeCommands.has(command)))
    throw new Error(`task ${taskId} requests a command outside the fixed verification allowlist`);
  return {
    policy,
    policyHash: hash(policyText),
    task,
    taskHash: hash(taskText),
  };
}

export async function taskLeaseSpec(taskId, cwd = process.cwd()) {
  const root = await rootFor(cwd);
  const { task } = await readPolicyAndTask(root, taskId);
  return { root: await realpath(root), resources: task.resources ?? [] };
}

async function sourceFingerprint(root) {
  const digest = createHash('sha256');
  digest.update(git(['rev-parse', 'HEAD'], { cwd: root }).trim());
  const diff = git(['diff', '--no-ext-diff', '--binary', 'HEAD', '--'], {
    cwd: root,
    encoding: 'buffer',
  });
  digest.update(diff);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root })
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const path of untracked) {
    digest.update(path);
    const absolutePath = resolve(root, path);
    const stat = await lstat(absolutePath);
    if (stat.isSymbolicLink()) digest.update(`symlink:${await readlink(absolutePath)}`);
    else if (stat.isFile()) {
      if (stat.size > 64 * 1024 * 1024)
        throw new Error(`untracked input is too large to fingerprint safely: ${path}`);
      digest.update(String(stat.size));
      digest.update(await readFile(absolutePath));
    } else digest.update(`special:${stat.mode}`);
  }
  return digest.digest('hex');
}

function testSummary(output, command) {
  if (!command.startsWith('test:')) return null;
  const tests = /^# tests (\d+)$/m.exec(output)?.[1] ?? /^ℹ tests (\d+)$/m.exec(output)?.[1];
  const failed = /^# fail (\d+)$/m.exec(output)?.[1] ?? /^ℹ fail (\d+)$/m.exec(output)?.[1];
  const skipped = /^# skipped (\d+)$/m.exec(output)?.[1] ?? /^ℹ skipped (\d+)$/m.exec(output)?.[1];
  const passed = /^# pass (\d+)$/m.exec(output)?.[1] ?? /^ℹ pass (\d+)$/m.exec(output)?.[1];
  if ([tests, failed, skipped, passed].some((value) => value === undefined))
    return {
      state: 'ERROR',
      tests: null,
      passed: null,
      failed: null,
      skipped: null,
      reason: 'test runner report is incomplete',
    };
  const summary = {
    tests: Number(tests),
    passed: Number(passed),
    failed: Number(failed),
    skipped: Number(skipped),
  };
  return {
    ...summary,
    state:
      summary.tests > 0 && summary.passed > 0 && summary.failed === 0 && summary.skipped === 0
        ? 'PASS'
        : 'FAIL',
  };
}

function npmCliPath() {
  const path = process.env.npm_execpath;
  if (!path) throw new Error('run `verify` via npm so the pinned npm CLI path is available');
  return path;
}

export function verificationEnvironment(environment = process.env) {
  const allowed = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'SystemRoot',
    'TMPDIR',
    'TMP',
    'TEMP',
    'JAVA_HOME',
    'GRADLE_USER_HOME',
    'NPM_CONFIG_CACHE',
    'npm_execpath',
    'npm_config_user_agent',
    'CI',
  ];
  return Object.fromEntries(
    allowed.filter((key) => environment[key] !== undefined).map((key) => [key, environment[key]])
  );
}

async function evidenceDirectory(root, create = false) {
  const gitPath = git(['rev-parse', '--git-path', 'harness-runs'], { cwd: root }).trim();
  const path = resolve(root, gitPath);
  if (create) await mkdir(path, { recursive: true, mode: 0o700 });
  return path;
}

export async function verifyTask(taskId, cwd = process.cwd()) {
  const root = await rootFor(cwd);
  const { policyHash, task, taskHash } = await readPolicyAndTask(root, taskId);
  const lease = await acquireTaskLeases(taskId, task.resources ?? [], root);
  try {
    return await runVerification(taskId, root, policyHash, task, taskHash);
  } finally {
    await lease.release();
  }
}

async function runVerification(taskId, root, policyHash, task, taskHash) {
  const npmCli = npmCliPath();
  const beforeFingerprint = await sourceFingerprint(root);
  const headSha = git(['rev-parse', 'HEAD'], { cwd: root }).trim();
  const branch = gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim() || null;
  const gitDir = git(['rev-parse', '--git-dir'], { cwd: root }).trim();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const checks = [];
  let state = 'PASS';

  for (const command of task.verification) {
    const started = Date.now();
    const result = spawnSync(process.execPath, [npmCli, 'run', command], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
      shell: false,
      env: verificationEnvironment(),
    });
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    const commandState = result.error ? 'ERROR' : result.status === 0 ? 'PASS' : 'FAIL';
    const report = testSummary(stdout, command);
    const checkState = report && report.state !== 'PASS' ? report.state : commandState;
    checks.push({
      command,
      state: checkState,
      exitCode: result.status,
      durationMs: Date.now() - started,
      stdoutSha256: hash(stdout),
      stderrSha256: hash(stderr),
      ...(report
        ? {
            tests: report.tests,
            passed: report.passed,
            failed: report.failed,
            skipped: report.skipped,
          }
        : {}),
      ...(result.error ? { errorCode: result.error.code ?? 'RUNNER_ERROR' } : {}),
    });
    if (result.error || result.status !== 0 || (report && report.state !== 'PASS')) {
      state = checkState;
      break;
    }
    console.log(
      `[verify] ${command} passed${report ? ` (${report.passed}/${report.tests}, skips=${report.skipped})` : ''}`
    );
  }
  if (state !== 'PASS') {
    for (const command of task.verification.slice(checks.length))
      checks.push({ command, state: 'BLOCKED', reason: 'an earlier required check did not pass' });
  }

  const afterFingerprint = await sourceFingerprint(root);
  if (afterFingerprint !== beforeFingerprint) state = 'ERROR';
  const startedTime = Date.parse(startedAt);
  const report = {
    schemaVersion: 1,
    evidenceType: 'local-verification',
    runId,
    taskId,
    taskManifestSha256: taskHash,
    policySha256: policyHash,
    target: { headSha, branch, worktreeId: hash(`${root}\0${gitDir}`).slice(0, 16) },
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    sourceFingerprint: {
      before: beforeFingerprint,
      after: afterFingerprint,
      stable: beforeFingerprint === afterFingerprint,
    },
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedTime,
    state,
    checks,
  };
  const directory = await evidenceDirectory(root, true);
  const reportPath = resolve(directory, `${taskId}-${Date.now()}-${runId}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  console.log(
    JSON.stringify(
      { ...report, evidenceFile: '.git/harness-runs/<task-id>-<run-id>.json' },
      null,
      2
    )
  );
  if (state !== 'PASS')
    throw new Error(`verification ${state}; see the local run record (${runId})`);
  return report;
}

async function latestReport(root, taskId) {
  const directory = await evidenceDirectory(root);
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const files = names
    .filter((name) => name.startsWith(`${taskId}-`) && name.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return JSON.parse(await readFile(resolve(directory, files[0]), 'utf8'));
}

export async function taskReady(taskId, cwd = process.cwd()) {
  const root = await rootFor(cwd);
  const { policyHash, task, taskHash } = await readPolicyAndTask(root, taskId);
  const report = await latestReport(root, taskId);
  if (!report) return { taskId, ready: false, reasons: ['no local verification record exists'] };
  const current = {
    headSha: git(['rev-parse', 'HEAD'], { cwd: root }).trim(),
    branch: gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim() || null,
    fingerprint: await sourceFingerprint(root),
  };
  const reasons = [];
  if (report.state !== 'PASS') reasons.push(`latest verification state is ${report.state}`);
  if (
    report.checks.length !== task.verification.length ||
    report.checks.some((check) => check.state !== 'PASS')
  )
    reasons.push('one or more required verification commands are missing or did not pass');
  if (report.target.headSha !== current.headSha) reasons.push('HEAD changed after verification');
  if (report.target.branch !== current.branch) reasons.push('branch changed after verification');
  if (report.sourceFingerprint.after !== current.fingerprint)
    reasons.push('source fingerprint changed after verification');
  if (report.policySha256 !== policyHash) reasons.push('harness policy changed after verification');
  if (report.taskManifestSha256 !== taskHash)
    reasons.push('task manifest changed after verification');
  return {
    taskId,
    ready: reasons.length === 0,
    reasons,
    runId: report.runId,
    state: report.state,
    checks: report.checks,
  };
}

export async function inspectTaskResume(taskId, cwd = process.cwd()) {
  const root = await rootFor(cwd);
  const { policyHash, task, taskHash } = await readPolicyAndTask(root, taskId);
  const leases = await inspectTaskLeases(taskId, task.resources ?? [], root);
  const report = await latestReport(root, taskId);
  const current = {
    headSha: git(['rev-parse', 'HEAD'], { cwd: root }).trim(),
    branch: gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim() || null,
    fingerprint: await sourceFingerprint(root),
    worktreeId: hash(`${root}\0${git(['rev-parse', '--git-dir'], { cwd: root }).trim()}`).slice(
      0,
      16
    ),
  };
  const reasons = [];
  if (!report) reasons.push('no local verification record exists');
  else {
    if (report.state !== 'PASS') reasons.push(`latest verification state is ${report.state}`);
    if (
      report.checks.length !== task.verification.length ||
      report.checks.some((check) => check.state !== 'PASS')
    )
      reasons.push('one or more required verification commands are missing or did not pass');
    if (report.target.headSha !== current.headSha) reasons.push('HEAD changed after verification');
    if (report.target.branch !== current.branch) reasons.push('branch changed after verification');
    if (report.sourceFingerprint.after !== current.fingerprint)
      reasons.push('source fingerprint changed after verification');
    if (report.target.worktreeId !== current.worktreeId)
      reasons.push('verification belongs to another worktree');
    if (report.policySha256 !== policyHash)
      reasons.push('harness policy changed after verification');
    if (report.taskManifestSha256 !== taskHash)
      reasons.push('task manifest changed after verification');
  }
  const verificationCurrent = reasons.length === 0;
  return {
    taskId,
    verificationState: report ? (verificationCurrent ? 'CURRENT' : 'STALE') : 'MISSING',
    verificationRunId: report?.runId ?? null,
    current,
    reasons,
    rerunCommands: verificationCurrent ? [] : [...task.verification],
    ownership: {
      state: leases.available
        ? 'AVAILABLE'
        : leases.locks.some((lock) => lock.state === 'LOCKED')
          ? 'LOCKED'
          : 'UNKNOWN',
      canResume: false,
      locks: leases.locks,
      reason: leases.available
        ? 'no active task/resource lease is held; an explicit lease must be acquired before execution'
        : leases.locks.some((lock) => lock.state === 'UNKNOWN')
          ? 'lease state is unreadable; failing closed without changing it'
          : 'another process holds a task or resource lease; automatic takeover is disabled',
    },
    canResume: false,
    note: 'read-only resume inspection; no worktree, process, database, or lease was modified',
  };
}

export async function handoffTask(taskId, cwd = process.cwd()) {
  const readiness = await taskReady(taskId, cwd);
  const root = await rootFor(cwd);
  const verification = await latestReport(root, taskId);
  const handoff = {
    schemaVersion: 1,
    handoffId: randomUUID(),
    taskId,
    handoffAt: new Date().toISOString(),
    readiness,
    latestRunId: verification?.runId ?? null,
    currentHead: git(['rev-parse', 'HEAD'], { cwd: root }).trim(),
    taskState: (await readPolicyAndTask(root, taskId)).task.state,
    note: 'handoff does not mark the task complete or grant approval',
  };
  const directory = await evidenceDirectory(root, true);
  const fileName = `handoff-${taskId}-${Date.now()}-${handoff.handoffId}.json`;
  await writeFile(resolve(directory, fileName), `${JSON.stringify(handoff, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
  return { ...handoff, evidenceFile: `.git/harness-runs/${fileName}` };
}
