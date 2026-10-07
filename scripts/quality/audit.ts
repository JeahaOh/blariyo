import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { hash, snapshot } from './receipt.ts';
import { evidenceDirectory } from './verify.ts';

const roots = ['apps/api/src/', 'apps/web/app/', 'apps/web/server/', 'apps/web/shared/', 'apps/collector/src/main/java/'];
const agentFiles = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeFindings(violations: unknown[]): { rule: string; file: string; line: number; severity: string; confidence: string }[] {
  return violations.map((value: unknown) => {
    if (!record(value) || typeof value.rule_id !== 'string' || typeof value.file_path !== 'string'
      || typeof value.line_number !== 'number' || typeof value.severity !== 'string'
      || typeof value.confidence !== 'string') throw new Error('AUDIT_FINDING_INVALID');
    return { rule: value.rule_id, file: value.file_path, line: value.line_number,
      severity: value.severity, confidence: value.confidence };
  });
}

function main(): void {
let temporary: string | undefined;
try {
  const { values } = parseArgs({ options: { task: { type: 'string' } } });
  if (!values.task) throw new Error('TASK_REQUIRED');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const directory = evidenceDirectory(root, values.task);
  const config = resolve(root, 'tools/iron-laws/config.yml');
  const inputSnapshot = snapshot(root);
  const executable = resolve(root, 'tools/iron-laws/.venv', process.platform === 'win32' ? 'Scripts/iron-laws.exe' : 'bin/iron-laws');
  const names = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
  temporary = mkdtempSync(join(tmpdir(), 'blariyo-advisory-'));
  const inputs: Record<string, string> = {}, unsupported: string[] = [];
  for (const name of names) {
    if (!roots.some(prefix => name.startsWith(prefix)) && !agentFiles.includes(name)) continue;
    if (name.endsWith('.vue')) { unsupported.push(name); continue; }
    if (!/\.(?:ts|mjs|js|java)$/.test(name) && !agentFiles.includes(name)) continue;
    const original = resolve(root, name);
    let stat;
    try { stat = lstatSync(original); } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile()) throw new Error('UNSUPPORTED_INPUT_KIND');
    const target = resolve(temporary, name);
    mkdirSync(dirname(target), { recursive: true }); copyFileSync(original, target);
    inputs[name] = hash(readFileSync(target));
  }
  if (!Object.keys(inputs).length) throw new Error('EMPTY_AUDIT');
  const startedAt = new Date().toISOString();
  const child = spawnSync(executable, ['audit', temporary, '--config', config, '--format', 'json'],
    { cwd: temporary, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000 });
  if (child.error || child.status === null || ![0, 1].includes(child.status)) throw new Error('AUDIT_INCOMPLETE');
  const data: unknown = JSON.parse(child.stdout);
  if (!record(data) || !record(data.summary) || data.summary.scan_status !== 'complete'
    || !Array.isArray(data.violations)) throw new Error('AUDIT_INVALID');
  const findings = sanitizeFindings(data.violations);
  if (snapshot(root).digest !== inputSnapshot.digest)
    throw new Error('AUDIT_INPUTS_CHANGED');
  const result = {
    tool: 'iron-laws', source: 'fd746b425dd566569b6bd4009ab04efef8afb0f6',
    startedAt, finishedAt: new Date().toISOString(), roots, inputs,
    inputDigest: inputSnapshot.digest,
    configHash: hash(readFileSync(config)), lockHash: hash(readFileSync(resolve(root, 'tools/iron-laws/requirements.lock'))),
    status: findings.length ? 'review_required' : 'no_findings_in_checked_scope', findings,
    inputFileCount: Object.keys(inputs).length,
    scannedFileCount: typeof data.summary.total_files_scanned === 'number' ? data.summary.total_files_scanned : null,
    unsupportedFiles: unsupported, unsupportedScopes: ['Gradle dependencies', 'cross-file semantic proof', 'production'],
    unverifiedRuleLanguageRate: typeof data.summary.unverified_rule_language_rate === 'number'
      ? data.summary.unverified_rule_language_rate : null,
  };
  const file = resolve(directory, `${startedAt.replaceAll(':', '-')}-iron-laws-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ file, status: result.status, findings: findings.length, unsupportedFiles: unsupported.length }));
  process.exitCode = findings.length ? 1 : 0;
} catch {
  console.error('ADVISORY_AUDIT_INCOMPLETE'); process.exitCode = 2;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}

}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
