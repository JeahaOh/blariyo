import '../apps/api/test/architecture.service.test.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, relative, extname } from 'node:path';
import ts from 'typescript';

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

function webLayerAllows(source: string, target: string) {
  const allowed: Record<string, string[]> = {
    app: ['app', 'shared'],
    server: ['server', 'shared'],
    shared: ['shared'],
  };
  return allowed[source]?.includes(target) ?? false;
}

function runtimeImportSpecifier(node: ts.Node, file: string): string | undefined {
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    const expression = node.moduleReference.expression;
    assert.ok(
      expression && ts.isStringLiteral(expression),
      `${file}: import-equals require paths must be statically traceable`
    );
    return expression.text;
  }
  if (!ts.isCallExpression(node)) return undefined;
  const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const commonJsRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  if (!dynamicImport && !commonJsRequire) return undefined;
  const argument = node.arguments[0];
  assert.ok(
    argument && ts.isStringLiteral(argument),
    `${file}: dynamic import and require paths must be statically traceable`
  );
  return argument.text;
}

await test('Collector feature packages have no cycles or reverse dependencies into triggers', async () => {
  const base = 'apps/collector/src/main/java/com/blariyo/collector',
    edges = new Map<string, Set<string>>();
  for (const file of await files(base, '.java')) {
    const source = await readFile(file, 'utf8');
    const packageName =
      /package com\.blariyo\.collector(?:\.([\w.]+))?;/.exec(source)?.[1] || 'root';
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
  const adapters = [
    ...registry.matchAll(/import com\.blariyo\.collector\.source\.sites\.(\w+)\.(\w+)Adapter;/g),
  ];
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
      for (const [, dependency] of source.matchAll(
        /com\.blariyo\.collector\.source\.sites\.(\w+)\./g
      ))
        assert.equal(dependency, site, file);
      assert.doesNotMatch(
        source,
        /com\.blariyo\.collector\.(?:storage|run|execution|core|config)\.|\b(?:SourceTransport|PinnedHttp|SourceRegistry|SiteAdapters)\b/,
        file
      );
      assert.doesNotMatch(
        source,
        /java\.(?:net\.(?:http\.|Http\w+|URL\b)|nio\.file\.|sql\.|io\.(?:File\w*|RandomAccessFile))|javax\.sql\.|\b(?:getenv|exec|openConnection)\(/,
        file
      );
    }
  }
  for (const file of await files(`${base}/common`, '.java')) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /source\.sites\.|\b(?:SiteAdapters|SourceRegistry)\b/, file);
  }
});

await test('Web uses contracts and HTTP instead of importing another app implementation', async () => {
  let scanned = 0;
  for (const directory of ['apps/web/app', 'apps/web/server', 'apps/web/shared']) {
    for (const ext of ['.ts', '.mjs', '.vue'])
      for (const file of await files(directory, ext)) {
        scanned += 1;
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
  assert.ok(scanned >= 50, `scan the Web source tree, found ${scanned}`);
});

await test('Web and contracts source imports stay within the declared workspace boundary', async () => {
  const webRoot = resolve('apps/web');
  const graph = new Map<string, Set<string>>();
  const webFiles: string[] = [];
  for (const directory of ['apps/web/app', 'apps/web/server', 'apps/web/shared']) {
    for (const ext of ['.ts', '.mjs', '.vue']) webFiles.push(...(await files(directory, ext)));
  }

  for (const file of webFiles) {
    const sourceText = await readFile(file, 'utf8');
    const scriptBlocks = [...sourceText.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
      (match) => match[1] ?? ''
    );
    const sourceCode = scriptBlocks.length ? scriptBlocks.join('\n') : sourceText;
    const source = ts.createSourceFile(file, sourceCode, ts.ScriptTarget.Latest, true);
    const targets = new Set<string>();
    const sourceLayer = relative(webRoot, file).split(/[\\/]/)[0] ?? '';
    function inspect(node: ts.Node): void {
      let specifier: string | undefined;
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
        specifier = node.moduleSpecifier.text;
      else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      else specifier = runtimeImportSpecifier(node, file);
      if (specifier) {
        assert.doesNotMatch(
          specifier,
          /(?:^|\/)apps\/(?:api|collector)(?:\/|$)|^@blariyo\/(?:api|collector)(?:\/|$)/,
          `${file} -> ${specifier}`
        );
        let localTarget: string | undefined;
        if (specifier.startsWith('.')) localTarget = resolve(dirname(file), specifier);
        else if (specifier.startsWith('@/') || specifier.startsWith('~/'))
          localTarget = resolve(webRoot, 'app', specifier.slice(2));
        if (localTarget) {
          assert.ok(
            localTarget.startsWith(`${webRoot}/`),
            `${file} escapes apps/web: ${specifier}`
          );
          const candidates = [localTarget];
          if (extname(localTarget) === '.js')
            candidates.push(localTarget.slice(0, -3) + '.ts', localTarget.slice(0, -3) + '.mjs');
          else if (!extname(localTarget))
            candidates.push(
              ...['.ts', '.mjs', '.js', '.vue', '.css', '.json', '.svg', '.png'].map(
                (ext) => localTarget + ext
              )
            );
          const resolved = candidates.find((candidate) => existsSync(candidate));
          assert.ok(resolved, `${file} has an unresolved internal import: ${specifier}`);
          if (['.ts', '.mjs', '.vue'].includes(extname(resolved))) {
            const targetLayer = relative(webRoot, resolved).split(/[\\/]/)[0] ?? '';
            assert.ok(
              webLayerAllows(sourceLayer, targetLayer),
              `${file} (${sourceLayer}) -> ${resolved} (${targetLayer})`
            );
            targets.add(resolved);
          }
        }
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    graph.set(file, targets);
  }

  const active = new Set<string>();
  const done = new Set<string>();
  function visit(file: string, trail: string[]) {
    assert.ok(!active.has(file), `Web runtime import cycle: ${[...trail, file].join(' -> ')}`);
    if (done.has(file)) return;
    active.add(file);
    for (const target of graph.get(file) ?? []) visit(target, [...trail, file]);
    active.delete(file);
    done.add(file);
  }
  for (const file of graph.keys()) visit(file, []);

  const contractFiles = [
    ...(await files('packages/contracts/src', '.mjs')),
    ...(await files('packages/contracts/src', '.d.ts')),
    ...(await files('packages/contracts/src', '.d.mts')),
  ];
  assert.ok(contractFiles.length > 0, 'scan contracts JavaScript and declaration modules');
  for (const file of contractFiles) {
    const sourceText = await readFile(file, 'utf8');
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
    function inspect(node: ts.Node): void {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        assert.doesNotMatch(
          node.moduleSpecifier.text,
          /(?:^|\/)apps\/(?:api|web|collector)(?:\/|$)|^@blariyo\/(?:api|web|collector)(?:\/|$)/,
          `${file} imports app implementation`
        );
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        assert.doesNotMatch(
          node.moduleSpecifier.text,
          /(?:^|\/)apps\/(?:api|web|collector)(?:\/|$)|^@blariyo\/(?:api|web|collector)(?:\/|$)/,
          `${file} re-exports app implementation`
        );
      } else if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        assert.ok(
          ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal),
          `${file} import type must be statically traceable`
        );
        assert.doesNotMatch(
          argument.literal.text,
          /(?:^|\/)apps\/(?:api|web|collector)(?:\/|$)|^@blariyo\/(?:api|web|collector)(?:\/|$)/,
          `${file} imports a type from app implementation`
        );
      }
      const runtimeSpecifier = runtimeImportSpecifier(node, file);
      if (runtimeSpecifier)
        assert.doesNotMatch(
          runtimeSpecifier,
          /(?:^|\/)apps\/(?:api|web|collector)(?:\/|$)|^@blariyo\/(?:api|web|collector)(?:\/|$)/,
          `${file} dynamically loads app implementation`
        );
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
});

await test('Web layer rules allow only app->app/shared, server->server/shared, and shared->shared', () => {
  assert.equal(webLayerAllows('app', 'server'), false);
  assert.equal(webLayerAllows('server', 'app'), false);
  assert.equal(webLayerAllows('shared', 'app'), false);
  assert.equal(webLayerAllows('shared', 'server'), false);
  assert.equal(webLayerAllows('app', 'shared'), true);
  assert.equal(webLayerAllows('server', 'shared'), true);
});

await test('runtime architecture graph rejects a cycle fixture', () => {
  const graph = new Map([
    ['app/a', new Set(['app/b'])],
    ['app/b', new Set(['app/a'])],
  ]);
  assert.throws(() => acyclic(graph), /Circular dependency: app\/a -> app\/b -> app\/a/);
});

await test('runtime import and CommonJS require edges must be statically traceable', () => {
  const source = ts.createSourceFile(
    'architecture-fixture.ts',
    `import legacy = require('@blariyo/contracts');\nconst allowed = require('@blariyo/contracts');\nconst unknown = require(moduleName);`,
    ts.ScriptTarget.Latest,
    true
  );
  const calls: ts.CallExpression[] = [];
  let importEquals: ts.ImportEqualsDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) calls.push(node);
    if (ts.isImportEqualsDeclaration(node)) importEquals = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  const allowedRequire = calls[0];
  const unknownRequire = calls[1];
  assert.ok(importEquals && allowedRequire && unknownRequire, 'fixture contains all edge types');
  assert.equal(runtimeImportSpecifier(importEquals, source.fileName), '@blariyo/contracts');
  assert.equal(runtimeImportSpecifier(allowedRequire, source.fileName), '@blariyo/contracts');
  assert.throws(
    () => runtimeImportSpecifier(unknownRequire, source.fileName),
    /statically traceable/
  );
});
