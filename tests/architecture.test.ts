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

await test('Collector feature packages have no cycles or reverse dependencies into triggers', async () => {
  const base = 'apps/collector/src/main/java/com/blariyo/collector',
    edges = new Map<string, Set<string>>();
  for (const file of await files(base, '.java')) {
    const source = await readFile(file, 'utf8');
    const packageName = /package com\.blariyo\.collector(?:\.([\w.]+))?;/.exec(source)?.[1] || 'root';
    assert.equal(
      dirname(relative(base, file)),
      packageName === 'root' ? '.' : packageName.replaceAll('.', '/')
    );
    // source contains its public contract, registry, shared parsers and site modules.
    // Check feature direction here and the more specific module boundaries below.
    const owner = packageName.startsWith('source.') ? 'source' : packageName;
    if (owner === 'root') assert.equal(file.split('/').at(-1), 'CollectorApplication.java');
    for (const [, importedPackage] of source.matchAll(
      /import (?:static )?com\.blariyo\.collector\.([a-z][a-z0-9_.]*)\.[A-Z]\w*(?:\.[\w*]+)*;/g
    )) {
      assert.ok(importedPackage);
      const target = importedPackage.startsWith('source.') ? 'source' : importedPackage;
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

await test('Collector site modules keep identity, list and detail separate without IO or cross-site dependencies', async () => {
  const base = 'apps/collector/src/main/java/com/blariyo/collector/source';
  const registry = await readFile(`${base}/SiteAdapters.java`, 'utf8');
  assert.doesNotMatch(registry, /org\.jsoup|Pattern|OrderedContentParser|class\s+\w+\s+extends/);
  const adapters = [...registry.matchAll(/import com\.blariyo\.collector\.source\.sites\.(\w+)\.(\w+)Adapter;/g)];
  assert.equal(adapters.length, 21);
  for (const [, site, name] of adapters) {
    assert.ok(site && name);
    const directory = `${base}/sites/${site}`;
    const names = await readdir(directory);
    const tests = await readdir(directory.replace('/main/', '/test/'));
    assert.ok(names.includes(`${name}DetailParser.java`), site);
    assert.ok(tests.includes(`${name}DetailParserTests.java`), site);
    const hasList = !['pgr21', 'youtubecommunity'].includes(site);
    assert.equal(names.includes(`${name}ListParser.java`), hasList, site);
    assert.equal(tests.includes(`${name}ListParserTests.java`), hasList, site);
    const adapter = await readFile(`${directory}/${name}Adapter.java`, 'utf8');
    assert.doesNotMatch(adapter, /org\.jsoup|\.select\(|\.selectFirst\(/);
    if (!hasList) assert.match(adapter, /CHART_UNVERIFIED/);
    for (const file of await files(directory, '.java')) {
      const source = await readFile(file, 'utf8');
      for (const [, dependency] of source.matchAll(/com\.blariyo\.collector\.source\.sites\.(\w+)\./g))
        assert.equal(dependency, site, file);
      assert.doesNotMatch(source,
        /com\.blariyo\.collector\.(?:storage|run|execution|core|config)\.|\b(?:SourceTransport|PinnedHttp|SourceRegistry|SiteAdapters)\b/,
        file);
      assert.doesNotMatch(source,
        /java\.(?:net\.(?:http\.|Http\w+|URL\b)|nio\.file\.|sql\.|io\.(?:File\w*|RandomAccessFile))|javax\.sql\.|\b(?:getenv|exec|openConnection)\(/,
        file);
    }
  }
  for (const file of await files(`${base}/common`, '.java')) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /source\.sites\.|\b(?:SiteAdapters|SourceRegistry)\b/, file);
  }
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
