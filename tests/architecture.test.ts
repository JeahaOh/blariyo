import '../apps/api/test/architecture.service.test.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

async function files(directory: string, extension: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await files(path, extension)));
    else if (path.endsWith(extension)) result.push(path);
  }
  return result;
}
function acyclic(edges: Map<string, Set<string>>) {
  const active = new Set<string>(),
    done = new Set<string>();
  function visit(node: string, trail: string[] = []) {
    assert.ok(!active.has(node), `Circular dependency: ${[...trail, node].join(' -> ')}`);
    if (done.has(node)) return;
    active.add(node);
    for (const target of edges.get(node) || []) visit(target, [...trail, node]);
    active.delete(node);
    done.add(node);
  }
  for (const node of edges.keys()) visit(node);
}

await test('Collector packages have no cycles or reverse dependencies into triggers', async () => {
  const base = 'apps/collector/src/main/java/com/blariyo/collector',
    edges = new Map<string, Set<string>>();
  for (const file of await files(base, '.java')) {
    const source = await readFile(file, 'utf8');
    const owner = /package com\.blariyo\.collector(?:\.([\w.]+))?;/.exec(source)?.[1] || 'root';
    assert.equal(
      dirname(relative(base, file)),
      owner === 'root' ? '.' : owner.replaceAll('.', '/')
    );
    if (owner === 'root') assert.equal(file.split('/').at(-1), 'CollectorApplication.java');
    for (const [, target] of source.matchAll(
      /import com\.blariyo\.collector\.([a-z][\w.]*)\.[A-Z]\w*;/g
    )) {
      assert.ok(target);
      if (owner === target) continue;
      if (owner === 'shared') assert.fail(`${file}: shared cannot depend on ${target}`);
      if (owner === 'config') assert.equal(target, 'shared', file);
      if (['run', 'source', 'core', 'spool', 'execution'].includes(owner))
        assert.ok(
          !['web', 'discord', 'scheduling', 'bootstrap', 'ops'].includes(target),
          `${file} -> ${target}`
        );
      if (owner === 'run') assert.notEqual(target, 'execution', file);
      if (['source', 'core', 'spool'].includes(owner)) assert.notEqual(target, 'run', file);
      if (!edges.has(owner)) edges.set(owner, new Set());
      const outgoing = edges.get(owner);
      assert.ok(outgoing);
      outgoing.add(target);
    }
  }
  acyclic(edges);
});

await test('Web uses contracts and HTTP instead of importing another app implementation', async () => {
  for (const directory of ['apps/web/app', 'apps/web/server']) {
    for (const ext of ['.ts', '.mjs', '.vue'])
      for (const file of await files(directory, ext)) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(
          source,
          /(?:from\s*|import\s*\()\s*['"][^'"]*(?:apps\/(?:api|collector)|@blariyo\/(?:api|collector))/
        );
        for (const [, spec] of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g))
          if (spec?.startsWith('.'))
            assert.ok(
              resolve(dirname(file), spec).startsWith(resolve('apps/web') + '/'),
              `${file} -> ${spec}`
            );
      }
  }
});
