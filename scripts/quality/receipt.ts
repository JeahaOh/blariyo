import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checksFor, excludedInputs } from './policy.ts';
import type { Check, Parser } from './policy.ts';

export interface Snapshot { head: string; files: Record<string, string>; digest: string }
export interface Counts { tests: number; passed: number; failed: number; skipped: number; todo: number }
export type State = 'pass' | 'fail' | 'not_run' | 'unknown';
export interface Result {
  id: string; command: string; args: string[]; parser: Parser;
  startedAt: string | null; finishedAt: string | null; exitCode: number | null;
  state: State; reason: string; counts: Counts | null;
  outputHash: string; outputBytes: number;
}
export interface Receipt {
  schema: 1; profile: string; root: string; startedAt: string; finishedAt: string; completed: boolean;
  versions: Record<string, string>; exclusions: string[]; start: Snapshot; end: Snapshot;
  results: Result[]; unsupported: string[];
}
export const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export function runtimeVersions(root: string): Record<string, string> {
  const version = (name: string): string => {
    const value: unknown = JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8'));
    if (!record(value) || typeof value.version !== 'string') throw new Error('TOOL_VERSION_UNKNOWN');
    return value.version;
  };
  return {
    node: process.version,
    npm: execFileSync('npm', ['--version'], { cwd: root, encoding: 'utf8' }).trim(),
    python: execFileSync('python3', ['--version'], { cwd: root, encoding: 'utf8' }).trim(),
    eslint: version('eslint'), typescript: version('typescript'), oxlint: version('oxlint'),
    playwright: version('@playwright/test'),
    java: process.env.JAVA_HOME
      ? execFileSync(resolve(process.env.JAVA_HOME, 'bin/java'), ['--version'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      : 'not-configured',
  };
}

export function snapshot(root: string): Snapshot {
  const git = (args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const names = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean))].sort();
  const files: Record<string, string> = {};
  for (const name of names) {
    if (excludedInputs.some(prefix => name.startsWith(prefix))) continue;
    const file = resolve(root, name);
    let stat;
    try { stat = lstatSync(file); } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        files[name] = 'deleted'; continue;
      }
      throw error;
    }
    if (!stat.isFile()) throw new Error('UNSUPPORTED_INPUT_KIND');
    files[name] = `${stat.mode & 0o111}:${hash(readFileSync(file))}`;
  }
  const head = git(['rev-parse', 'HEAD']).trim();
  return { head, files, digest: hash(JSON.stringify({ head, files })) };
}

export function parseCounts(output: string, parser: Parser): Counts | null {
  if (parser === 'exit') return null;
  if (parser === 'unittest') {
    const ran = /Ran (\d+) tests? in [\d.]+s\s+OK(?: \(skipped=(\d+)\))?\s*$/.exec(output);
    if (!ran) return null;
    const tests = Number(ran[1]), skipped = Number(ran[2] ?? 0);
    return { tests, passed: tests - skipped, failed: 0, skipped, todo: 0 };
  }
  const values = (key: string): number[] => Array.from(output.matchAll(
    new RegExp(`^(?:#|ℹ) ${key} (\\d+)\\s*$`, 'gm')), match => Number(match[1]));
  const tests = values('tests'), passed = values('pass'), failed = values('fail');
  const skipped = values('skipped'), todo = values('todo');
  if (parser === 'node-files') {
    const groups = tests.length;
    if (!groups || [passed, failed, skipped, todo].some(list => list.length !== groups)) return null;
    const total: Counts = { tests: 0, passed: 0, failed: 0, skipped: 0, todo: 0 };
    for (let i = 0; i < groups; i++) {
      const group = { tests: tests[i] ?? 0, passed: passed[i] ?? 0, failed: failed[i] ?? 0,
        skipped: skipped[i] ?? 0, todo: todo[i] ?? 0 };
      if (group.tests < 1 || group.tests !== group.passed + group.failed + group.skipped + group.todo) return null;
      for (const key of ['tests', 'passed', 'failed', 'skipped', 'todo'] as const) total[key] += group[key];
    }
    return total;
  }
  if (tests.length !== 1 || passed.length !== 1 || failed.length !== 1
    || skipped.length !== 1 || todo.length !== 1) return null;
  return { tests: tests[0] ?? 0, passed: passed[0] ?? 0, failed: failed[0] ?? 0,
    skipped: skipped[0] ?? 0, todo: todo[0] ?? 0 };
}

export function classify(exitCode: number | null, parser: Parser, counts: Counts | null): State {
  if (exitCode === null) return 'unknown';
  if (exitCode !== 0) return 'fail';
  if (parser === 'exit') return counts === null ? 'pass' : 'unknown';
  if (!counts || counts.tests < 1 || counts.tests !== counts.passed + counts.failed + counts.skipped + counts.todo)
    return 'unknown';
  if (counts.failed > 0) return 'fail';
  if (counts.skipped > 0 || counts.todo > 0) return 'unknown';
  return 'pass';
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string'); }
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
function counts(value: unknown): value is Counts {
  return record(value) && ['tests', 'passed', 'failed', 'skipped', 'todo'].every(key => integer(value[key]));
}
function isSnapshot(value: unknown): value is Snapshot {
  return record(value) && typeof value.head === 'string' && /^[a-f0-9]{40}$/.test(value.head)
    && typeof value.digest === 'string' && record(value.files)
    && Object.values(value.files).every(v => typeof v === 'string')
    && value.digest === hash(JSON.stringify({ head: value.head, files: value.files }));
}
function isResult(value: unknown): value is Result {
  return record(value) && typeof value.id === 'string' && typeof value.command === 'string'
    && strings(value.args) && ['exit', 'node', 'node-files', 'unittest'].includes(String(value.parser))
    && ['pass', 'fail', 'not_run', 'unknown'].includes(String(value.state))
    && (value.startedAt === null || typeof value.startedAt === 'string')
    && (value.finishedAt === null || typeof value.finishedAt === 'string')
    && (value.exitCode === null || integer(value.exitCode)) && typeof value.reason === 'string'
    && (value.counts === null || counts(value.counts)) && integer(value.outputBytes)
    && typeof value.outputHash === 'string' && /^[a-f0-9]{64}$/.test(value.outputHash);
}
function isReceipt(value: unknown): value is Receipt {
  return record(value) && value.schema === 1 && typeof value.profile === 'string'
    && typeof value.completed === 'boolean'
    && typeof value.root === 'string' && typeof value.startedAt === 'string'
    && typeof value.finishedAt === 'string' && record(value.versions) && typeof value.versions.node === 'string'
    && Object.values(value.versions).every(version => typeof version === 'string')
    && strings(value.exclusions) && strings(value.unsupported) && isSnapshot(value.start)
    && isSnapshot(value.end) && Array.isArray(value.results) && value.results.every(isResult);
}

export function loadReceipt(file: string): Receipt {
  const input: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isReceipt(input)) throw new Error('INVALID_RECEIPT');
  return input;
}

export function assess(receipt: Receipt, current: Snapshot, expected: Check[], root: string,
  versions: Record<string, string> = { node: process.version }): string[] {
  const problems: string[] = [];
  if (!receipt.completed) problems.push('execution-incomplete');
  if (resolve(receipt.root) !== resolve(root)) problems.push('repository-mismatch');
  if (JSON.stringify(receipt.versions) !== JSON.stringify(versions)) problems.push('runtime-changed');
  if (JSON.stringify(receipt.exclusions) !== JSON.stringify(excludedInputs)) problems.push('policy-exclusions-changed');
  if (receipt.start.digest !== receipt.end.digest) problems.push('inputs-changed-during-run');
  if (receipt.end.digest !== current.digest) problems.push('stale-inputs');
  if (receipt.results.length !== expected.length) problems.push('unexpected-check-count');
  for (const check of expected) {
    const matches = receipt.results.filter(result => result.id === check.id);
    const result = matches[0];
    if (matches.length !== 1 || !result) { problems.push(`${check.id}:missing-or-duplicate`); continue; }
    if (result.command !== check.command || JSON.stringify(result.args) !== JSON.stringify(check.args)
      || result.parser !== check.parser) problems.push(`${check.id}:command-changed`);
    if (!result.startedAt || !result.finishedAt || !Number.isFinite(Date.parse(result.startedAt))
      || !Number.isFinite(Date.parse(result.finishedAt)) || result.finishedAt < result.startedAt)
      problems.push(`${check.id}:missing-execution`);
    if (result.state !== 'pass' || classify(result.exitCode, check.parser, result.counts) !== 'pass'
      || result.reason !== 'completed') problems.push(`${check.id}:not-passing`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2];
    if (!file || process.argv.length !== 3) throw new Error('USAGE: quality:receipt <receipt.json>');
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const receipt = loadReceipt(file);
    const problems = assess(receipt, snapshot(root), checksFor(receipt.profile), root, runtimeVersions(root));
    console.log(JSON.stringify({ profile: receipt.profile, valid: problems.length === 0, problems }));
    process.exitCode = problems.length ? 1 : 0;
  } catch {
    console.error('RECEIPT_INVALID_OR_UNREADABLE'); process.exitCode = 2;
  }
}
