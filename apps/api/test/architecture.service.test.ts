import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import ts from 'typescript';

async function files(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(path)));
    else if (entry.name.endsWith('.ts')) found.push(path);
  }
  return found;
}
const base = new URL('../src/', import.meta.url);

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

await test('Nest TypeScript runtime has acyclic imports and SQL/ORM remains inside persistence', async () => {
  const root = resolve(base.pathname);
  const edges = new Map<string, Set<string>>();
  const all = await files(root);
  assert.ok(all.length > 50, 'scan the actual Core source tree');
  for (const file of all) {
    const name = relative(root, file);
    const text = await readFile(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const persistence = name.startsWith('persistence/');
    const business = /\.(?:service|controller|repository)\.ts$/.test(name) && !persistence;
    assert.doesNotMatch(text, /@ts-(?:ignore|nocheck)|\bforwardRef\s*\(/, name);
    const dependencies = new Set<string>();
    edges.set(name, dependencies);
    const imports: { specifier: string; runtime: boolean }[] = [];
    function inspect(node: ts.Node): void {
      assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, name + ': explicit any');
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const onlyTypes =
          clause?.isTypeOnly ||
          (!clause?.name &&
            named &&
            ts.isNamedImports(named) &&
            named.elements.every((element) => element.isTypeOnly));
        imports.push({ specifier: node.moduleSpecifier.text, runtime: !onlyTypes });
        assert.doesNotMatch(
          node.moduleSpecifier.text,
          /^(?:@blariyo\/(?:web|collector)|apps\/(?:web|collector))(?:\/|$)/,
          name + ': cross-app workspace dependency'
        );
      }
      const runtimeSpecifier = runtimeImportSpecifier(node, name);
      if (runtimeSpecifier) {
        assert.doesNotMatch(
          runtimeSpecifier,
          /^(?:@blariyo\/(?:web|collector)|apps\/(?:web|collector))(?:\/|$)/,
          name + ': cross-app workspace dependency'
        );
        imports.push({ specifier: runtimeSpecifier, runtime: true });
      }
      if (business && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        assert.ok(
          !['query', 'createQueryBuilder', 'getRepository', 'createQueryRunner'].includes(
            node.expression.name.text
          ),
          name + ': direct DB call'
        );
      }
      if (business && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
        assert.doesNotMatch(
          node.text,
          /\b(?:SELECT\s+.+\s+FROM|UPDATE\s+[\w.]+\s+SET|INSERT\s+INTO|DELETE\s+FROM)\b/i,
          name + ': SQL in use case'
        );
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    for (const { specifier, runtime } of imports) {
      if (!persistence)
        assert.ok(
          specifier !== 'typeorm' && specifier !== 'pg',
          name + ': driver or ORM outside persistence'
        );
      if (!specifier.startsWith('.')) continue;
      assert.ok(specifier.endsWith('.js'), name + ': source import must resolve to compiled JS');
      const target = resolve(dirname(file), specifier.replace(/\.js$/, '.ts'));
      await access(target);
      assert.ok(target.startsWith(root + '/'), name + ': cross-app import');
      const targetName = relative(root, target);
      if (business)
        assert.ok(
          !targetName.startsWith('persistence/'),
          name + ': concrete persistence dependency'
        );
      if (name.startsWith('shared/'))
        assert.ok(targetName.startsWith('shared/'), name + ': shared reverse dependency');
      if (name.startsWith('features/') && targetName.startsWith('features/')) {
        const owner = name.split('/')[1],
          dependency = targetName.split('/')[1];
        if (owner !== dependency)
          assert.ok(
            (owner === 'collection' && ['posts', 'images'].includes(dependency ?? '')) ||
              (owner === 'posts' && dependency === 'images'),
            `${name} -> ${targetName}`
          );
      }
      if (runtime) dependencies.add(targetName);
    }
  }
  const active = new Set<string>(),
    done = new Set<string>();
  function visit(name: string, trail: string[]) {
    assert.ok(!active.has(name), 'Runtime circular dependency: ' + [...trail, name].join(' -> '));
    if (done.has(name)) return;
    active.add(name);
    for (const target of edges.get(name) ?? []) visit(target, [...trail, name]);
    active.delete(name);
    done.add(name);
  }
  for (const name of edges.keys()) visit(name, []);
});

await test('Nest architecture rejects non-static CommonJS require edges', () => {
  const source = ts.createSourceFile(
    'api-architecture-fixture.ts',
    `import web = require('@blariyo/web');\nrequire('@blariyo/web');\nrequire(runtimePackage);`,
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
  const knownRequire = calls[0];
  const unknownRequire = calls[1];
  assert.ok(importEquals && knownRequire && unknownRequire, 'fixture contains all edge types');
  assert.equal(runtimeImportSpecifier(importEquals, source.fileName), '@blariyo/web');
  assert.equal(runtimeImportSpecifier(knownRequire, source.fileName), '@blariyo/web');
  assert.throws(
    () => runtimeImportSpecifier(unknownRequire, source.fileName),
    /statically traceable/
  );
});
