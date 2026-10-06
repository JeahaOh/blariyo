import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

await test('selected Oxlint rules detect reducer copies in TypeScript and Vue, preserving owned mutation', t => {
  const root = resolve(import.meta.dirname, '..'), directory = mkdtempSync(join(tmpdir(), 'blariyo-rules-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const run = (file: string) => spawnSync(resolve(root, 'node_modules/.bin/oxlint'),
    ['--config', resolve(root, 'oxlint.config.ts'), '--format', 'json', file], { cwd: root, encoding: 'utf8' });
  const bad = join(directory, 'bad.ts');
  writeFileSync(bad, 'export function f(xs: number[]) { return xs.reduce<number[]>((a, x) => a.concat([x]), []); }\nexport function g(xs: number[]) { return xs.reduce<number[]>((a, x) => [...a, x], []); }\n');
  const before = readFileSync(bad, 'utf8'), result = run(bad);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /anti-slop\(no-reduce-accumulator-copy\)/);
  assert.match(result.stdout, /oxc\(no-accumulating-spread\)/);
  assert.equal(readFileSync(bad, 'utf8'), before, 'inspection must not autofix');
  const good = join(directory, 'good.ts');
  writeFileSync(good, 'export function f(xs: number[]) { return xs.reduce<number[]>((a, x) => { a.push(x); return a; }, []); }\n');
  assert.equal(run(good).status, 0);
  const vue = join(directory, 'Probe.vue');
  writeFileSync(vue, '<script setup lang="ts">const xs: number[] = [1]; const result = xs.reduce<number[]>((a, x) => a.concat([x]), []);</script><template>{{ result }}</template>');
  const vueResult = run(vue);
  assert.equal(vueResult.status, 1);
  assert.match(vueResult.stdout, /anti-slop\(no-reduce-accumulator-copy\)/);
});
