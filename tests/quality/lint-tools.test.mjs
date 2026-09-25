import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import stylelint from 'stylelint';
import { lint as markdownLint } from 'markdownlint/sync';
import jsoncParse from 'markdownlint-cli2/parsers/jsonc';

const root = resolve(import.meta.dirname, '../..');
const commonGitDir = resolve(
  root,
  execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()
);
const localPython = resolve(commonGitDir, 'quality-venv/bin/python');
const python = process.env.QUALITY_PYTHON ?? (existsSync(localPython) ? localPython : 'python3');
const nativeTools = resolve(commonGitDir, 'quality-tools');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

test('ESLint and Prettier fixtures distinguish valid source from violations', async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: resolve(root, 'scripts/quality/eslint.config.mjs'),
  });
  const validLint = await eslint.lintText('export const fixture = 1;\n', {
    filePath: 'scripts/quality/fixture.mjs',
  });
  const invalidLint = await eslint.lintText('const unused = 1;\n', {
    filePath: 'scripts/quality/fixture.mjs',
  });
  assert.equal(validLint[0].errorCount, 0);
  assert.ok(invalidLint[0].errorCount > 0);

  const apiRoot = resolve(root, 'apps/api');
  const apiEslint = new ESLint({
    cwd: apiRoot,
    overrideConfigFile: resolve(apiRoot, 'eslint.config.mjs'),
  });
  const validTypeScript = await apiEslint.lintText("export const fixture: string = 'ok';\n", {
    filePath: 'src/main.ts',
  });
  const invalidTypeScript = await apiEslint.lintText("const fixture: any = 'bad';\n", {
    filePath: 'src/main.ts',
  });
  assert.equal(validTypeScript[0].errorCount, 0);
  assert.ok(invalidTypeScript[0].errorCount > 0);

  const webRoot = resolve(root, 'apps/web');
  const webEslint = new ESLint({
    cwd: webRoot,
    overrideConfigFile: resolve(webRoot, 'eslint.config.mjs'),
  });
  const validVue = await webEslint.lintText('<template><main>ok</main></template>\n', {
    filePath: 'app/app.vue',
  });
  const invalidVue = await webEslint.lintText(
    '<script setup lang="ts">const fixture: any = 1</script>\n<template><main>{{ fixture }}</main></template>\n',
    { filePath: 'app/app.vue' }
  );
  assert.equal(validVue[0].errorCount, 0);
  assert.ok(invalidVue[0].errorCount > 0);

  const prettierConfig = await prettier.resolveConfig(resolve(root, 'scripts/quality/fixture.mjs'));
  assert.equal(
    await prettier.check('export const fixture = 1;\n', {
      ...prettierConfig,
      filepath: resolve(root, 'scripts/quality/fixture.mjs'),
    }),
    true
  );
  assert.equal(
    await prettier.check('export const fixture={a:1}\n', {
      ...prettierConfig,
      filepath: resolve(root, 'scripts/quality/fixture.mjs'),
    }),
    false
  );
});

test('Stylelint and Markdownlint fixtures distinguish valid content from violations', async () => {
  const css = (code) =>
    stylelint.lint({
      code,
      codeFilename: resolve(root, 'apps/web/app/assets/css/fixture.css'),
      configFile: resolve(root, '.stylelintrc.json'),
    });
  assert.equal((await css('.fixture { color: red; }\n')).errored, false);
  assert.equal((await css('.fixture { color: red; color: blue; }\n')).errored, true);

  const config = jsoncParse(
    await import('node:fs/promises').then(({ readFile }) =>
      readFile(resolve(root, '.markdownlint-cli2.jsonc'), 'utf8')
    )
  ).config;
  assert.equal(
    markdownLint({ strings: { fixture: '# Title\n\nBody.\n' }, config }).fixture.length,
    0
  );
  assert.ok(
    markdownLint({ strings: { fixture: '# Title\n\n## Repeated\n\n## Repeated\n' }, config })
      .fixture.length > 0
  );
});

test('Ruff fixtures distinguish valid Python from an undefined name', () => {
  const valid = run(
    python,
    ['-m', 'ruff', 'check', '--isolated', '--stdin-filename', 'fixture.py', '-'],
    {
      input: 'fixture = 1\n',
    }
  );
  const invalid = run(
    python,
    ['-m', 'ruff', 'check', '--isolated', '--stdin-filename', 'fixture.py', '-'],
    {
      input: 'print(undefined_name)\n',
    }
  );
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
});

test('SQLFluff fixtures distinguish valid SQL from a configured style violation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blariyo-sqlfluff-'));
  try {
    const validPath = join(directory, 'valid.sql');
    const invalidPath = join(directory, 'invalid.sql');
    await writeFile(validPath, 'SELECT 1;\n');
    await writeFile(invalidPath, 'SeLeCt 1;\n');
    const args = (file) => [
      '-m',
      'sqlfluff',
      'lint',
      '--format',
      'json',
      '--config',
      resolve(root, '.sqlfluff'),
      file,
    ];
    const valid = run(python, args(validPath));
    const invalid = run(python, args(invalidPath));
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
    assert.ok(JSON.parse(invalid.stdout)[0].violations.length > 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ShellCheck and actionlint fixtures distinguish valid inputs from violations', () => {
  const shellcheck = resolve(nativeTools, 'shellcheck');
  const validShell = run(shellcheck, ['--severity=style', '-'], {
    input: "#!/bin/sh\nprintf '%s\\n' hello\n",
  });
  const invalidShell = run(shellcheck, ['--severity=style', '-'], {
    input: '#!/bin/sh\nprintf "$1"\n',
  });
  assert.equal(validShell.status, 0, validShell.stdout + validShell.stderr);
  assert.equal(invalidShell.status, 1, invalidShell.stdout + invalidShell.stderr);

  const actionlint = resolve(nativeTools, 'actionlint');
  const validWorkflow = run(actionlint, ['-'], {
    input:
      'name: fixture\non: push\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n',
  });
  const invalidWorkflow = run(actionlint, ['-'], {
    input:
      'name: fixture\non: push\njobs:\n  check:\n    steps:\n      - run: echo missing-runner\n',
  });
  assert.equal(validWorkflow.status, 0, validWorkflow.stdout + validWorkflow.stderr);
  assert.equal(invalidWorkflow.status, 1, invalidWorkflow.stdout + invalidWorkflow.stderr);
});

test('Collector Checkstyle fixtures distinguish valid Java from trailing whitespace', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blariyo-checkstyle-'));
  const fixture = join(directory, 'Fixture.java');
  const initScript = join(directory, 'checkstyle-fixture.gradle');
  await writeFile(
    initScript,
    `gradle.projectsEvaluated {\n` +
      `  def collector = gradle.rootProject\n` +
      `  collector.tasks.register('qualityStyleFixture', org.gradle.api.plugins.quality.Checkstyle) {\n` +
      `    source = collector.file(System.getProperty('qualityFixtureFile'))\n` +
      `    classpath = collector.files()\n` +
      `    configFile = collector.file('config/checkstyle/checkstyle.xml')\n` +
      `    checkstyleClasspath = collector.configurations.getByName('checkstyle')\n` +
      `  }\n` +
      `}\n`
  );
  const gradle = resolve(root, 'apps/collector/gradlew');
  const check = () =>
    run(
      gradle,
      [
        '-p',
        resolve(root, 'apps/collector'),
        '--console=plain',
        '-I',
        initScript,
        'qualityStyleFixture',
        `-DqualityFixtureFile=${fixture}`,
        '--rerun-tasks',
      ],
      { maxBuffer: 32 * 1024 * 1024 }
    );
  try {
    await writeFile(fixture, 'class Fixture {\n}\n');
    const valid = check();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    await writeFile(fixture, 'class Fixture {   \n}\n');
    const invalid = check();
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
