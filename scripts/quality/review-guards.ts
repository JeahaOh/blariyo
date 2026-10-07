import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';

export interface Finding { rule: string; path: string; line: number; before: number; after: number; reason: string }
interface Marks { tests: number[]; focused: number[]; skipped: number[]; assertions: number[]; ignores: number[] }

function marks(text: string, path: string): Marks {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const result: Marks = { tests: [], focused: [], skipped: [], assertions: [], ignores: [] };
  const line = (node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      const test = /^(?:test|it|describe|suite|t\.test)(?:\.(?:skip|only|todo))?$/.test(name);
      if (test) {
        result.tests.push(line(node));
        if (/\.only$/.test(name)) result.focused.push(line(node));
        if (/\.(?:skip|todo)$/.test(name)) result.skipped.push(line(node));
        for (const argument of node.arguments) {
          if (!ts.isObjectLiteralExpression(argument)) continue;
          for (const property of argument.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const key = property.name.getText(source).replaceAll(/["']/g, '');
            if (property.initializer.kind === ts.SyntaxKind.FalseKeyword) continue;
            if (key === 'skip' || key === 'todo') result.skipped.push(line(property));
            if (key === 'only') result.focused.push(line(property));
          }
        }
      }
      if (/^assert(?:\.|$)/.test(name) || /^expect\([\s\S]*\)\./.test(name)) result.assertions.push(line(node));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    if (/eslint-disable|@ts-ignore|@ts-nocheck|oxlint-disable|iron-laws:\s*ignore/.test(scanner.getTokenText()))
      result.ignores.push(source.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1);
  }
  return result;
}

export function reviewChange(path: string, before: string, after: string): Finding[] {
  const found: Finding[] = [];
  const code = /\.[cm]?[jt]sx?$/.test(path);
  if (code) {
    const old = marks(before, path), next = marks(after, path);
    const rules: [keyof Marks, boolean, string][] = [
      ['tests', false, 'test-count-decreased'], ['assertions', false, 'assertion-count-decreased'],
      ['skipped', true, 'test-skip-added'], ['focused', true, 'test-only-added'], ['ignores', true, 'ignore-added'],
    ];
    for (const [key, increase, rule] of rules) {
      const a = old[key].length, b = next[key].length;
      if (increase ? b > a : b < a) found.push({ rule, path, line: next[key][0] ?? 1, before: a, after: b,
        reason: '검토 후보: 개수 변화는 의미적 약화의 증명이 아니며 요구 변경·이동 여부를 대조해야 함' });
    }
  }
  if (before !== after && /(?:^|\/)(?:eslint\.config\.[cm]?js|tsconfig[^/]*\.json|\.oxlintrc\.json|oxlint\.config\.ts|\.iron-laws\.yml)$/.test(path)) {
    found.push({ rule: 'inspection-policy-changed', path, line: 1, before: 1, after: 1,
      reason: '검사 설정 변경: strict/ignore/rule/포함 범위 변경의 근거를 대조' });
  }
  if (before !== after && (/^\.github\/workflows\/.*\.ya?ml$/.test(path)
    || /(?:^|\/)package\.json$/.test(path) || path.startsWith('.githooks/') || path.startsWith('scripts/quality/')
    || path.startsWith('tools/oxlint/') || /^tools\/iron-laws\/(?:config\.yml|requirements\.lock)$/.test(path))) {
    found.push({ rule: 'verification-policy-changed', path, line: 1, before: 1, after: 1,
      reason: '검사 실행·판정 정책 변경: 필수 명령/조건/실패 무시 여부를 이전 기준으로 검토' });
  }
  return found;
}

export function review(root: string, base: string): { base: string; findings: Finding[]; unsupported: string[]; files: number } {
  const git = (args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  // Resolve before using a revision in git show; no caller-provided option is executed.
  const sha = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
  const status = git(['diff', '--name-status', '-z', '--find-renames', sha, '--']).split('\0').filter(Boolean);
  const changes: { before: string | null; after: string }[] = [];
  for (let i = 0; i < status.length;) {
    const kind = status[i++], first = status[i++];
    if (!kind || !first) throw new Error('INVALID_GIT_DIFF');
    if (kind.startsWith('R')) {
      const second = status[i++]; if (!second) throw new Error('INVALID_RENAME');
      changes.push({ before: first, after: second });
    } else changes.push({ before: kind === 'A' ? null : first, after: first });
  }
  for (const path of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))
    if (!changes.some(change => change.after === path)) changes.push({ before: null, after: path });
  const findings: Finding[] = [], unsupported: string[] = [];
  let files = 0;
  for (const change of changes) {
    if (change.after.startsWith('worklog/')) continue;
    files++;
    if (!/\.(?:[cm]?[jt]sx?|json|ya?ml|lock)$/.test(change.after) && !change.after.startsWith('.githooks/')) {
      unsupported.push(change.after); continue;
    }
    const old = change.before ? git(['show', `${sha}:${change.before}`]) : '';
    const path = resolve(root, change.after);
    if (existsSync(path) && !lstatSync(path).isFile()) throw new Error('UNSUPPORTED_INPUT_KIND');
    const next = existsSync(path) ? readFileSync(path, 'utf8') : '';
    findings.push(...reviewChange(change.after, old, next));
  }
  return { base: sha, findings, unsupported, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { base: { type: 'string' } } });
    if (!values.base) throw new Error('BASE_REQUIRED');
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const report = review(root, values.base);
    console.log(JSON.stringify({ status: report.findings.length ? 'review_required' : 'no_candidates', ...report }, null, 2));
    process.exitCode = report.findings.length ? 1 : 0;
  } catch {
    console.error('GUARD_REVIEW_INCOMPLETE'); process.exitCode = 2;
  }
}
