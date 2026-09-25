import { access, readdir } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { requireNonEmptyScope } from './lint-contracts.mjs';
import { sqlFiles } from './lint-debt.mjs';

const root = resolve(import.meta.dirname, '../..');
if (process.version !== 'v24.18.0')
  throw new Error(`lint:all requires Node v24.18.0; got ${process.version}`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gradle =
  process.platform === 'win32' ? 'apps/collector/gradlew.bat' : 'apps/collector/gradlew';
const commonGitDir = resolve(
  root,
  execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()
);
const localPython = resolve(commonGitDir, 'quality-venv/bin/python');
let python = process.env.QUALITY_PYTHON ?? 'python3';
if (!process.env.QUALITY_PYTHON) {
  try {
    await access(localPython);
    python = localPython;
  } catch {
    // Local virtual environment is optional; CI installs these tools into setup-python.
  }
}
const qualityBin = resolve(commonGitDir, 'quality-tools');
const nativeTool = (name) => resolve(qualityBin, name);

async function countFiles(directory, extensions) {
  let count = 0;
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(`${directory}/${entry.name}`, extensions);
    else if (extensions.some((extension) => entry.name.endsWith(extension))) count += 1;
  }
  return count;
}

function run(command, args, label) {
  return new Promise((resolveRun) => {
    console.log(`\n[lint:all] ${label}`);
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', (error) => {
      console.error(`[lint:all] ${label}: could not start (${error.message})`);
      resolveRun(false);
    });
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun(true);
      else {
        console.error(`[lint:all] ${label}: failed (${signal ?? code ?? 'unknown'})`);
        resolveRun(false);
      }
    });
  });
}

async function findFiles(directory, extensions) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(resolve(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
        files.push(child);
    }
  }
  await visit(directory);
  return files.sort();
}

function trackedFiles(patterns) {
  return execFileSync('git', ['ls-files', '-z', '--', ...patterns], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

const scopes = [
  ['apps/api/src', ['.ts']],
  ['apps/api/test', ['.ts']],
  ['apps/web/app', ['.ts', '.mjs', '.vue']],
  ['apps/web/server', ['.ts', '.mjs', '.vue']],
  ['apps/web/shared', ['.ts', '.mjs', '.vue']],
  ['packages/contracts/src', ['.mjs', '.mts', '.ts']],
  ['scripts', ['.ts', '.mjs']],
  ['tests', ['.ts', '.mjs']],
  ['apps/collector/src/main/java', ['.java']],
  ['apps/collector/src/test/java', ['.java']],
  ['scripts/quality', ['.mjs']],
  ['scripts/harness', ['.mjs']],
  ['tests/harness', ['.mjs']],
  ['deploy', ['.py']],
  ['scripts', ['.py']],
  ['tools', ['.py']],
  ['apps/web/app/assets/css', ['.css']],
];

const failures = [];
for (const [directory, extensions] of scopes) {
  const count = await countFiles(directory, extensions);
  requireNonEmptyScope(directory, count);
  console.log(`[lint:all] scope ${directory}: ${count} file(s)`);
}
const sqlScope = await sqlFiles();
requireNonEmptyScope('SQL', sqlScope.length);
console.log(`[lint:all] scope SQL: ${sqlScope.length} file(s)`);
for (const [label, patterns] of [
  ['Markdown', ['*.md', '*.mdx']],
  ['GitHub Actions workflow', ['.github/workflows/*.yml']],
]) {
  const files = trackedFiles(patterns).filter(
    (path) =>
      label !== 'Markdown' || (!path.startsWith('worklog/') && !path.startsWith('codex-session-'))
  );
  const listing = files.length;
  requireNonEmptyScope(label, listing);
  console.log(`[lint:all] scope ${label}: ${listing} file(s)`);
}

async function check(command, args, label) {
  if (!(await run(command, args, label))) failures.push(label);
}

await check(npm, ['run', 'lint', '-w', '@blariyo/api'], 'API TypeScript lint');
await check(
  npm,
  ['exec', '--workspace', '@blariyo/web', '--', 'nuxt', 'prepare'],
  'Web TypeScript configuration'
);
await check(npm, ['run', 'lint', '-w', '@blariyo/web'], 'Web TypeScript/Vue lint');
await check(npm, ['run', 'lint', '-w', '@blariyo/contracts'], 'contracts lint');
await check(npm, ['run', 'lint:scripts'], 'scripts TypeScript lint');
await check(npm, ['run', 'lint:tests'], 'tests TypeScript lint');
await check(
  npm,
  [
    'exec',
    '--',
    'eslint',
    '--config',
    'scripts/quality/eslint.config.mjs',
    'scripts/**/*.mjs',
    'tests/**/*.mjs',
  ],
  'JavaScript module lint'
);
await check(
  resolve(root, gradle),
  ['-p', 'apps/collector', 'qualityStyle'],
  'Collector Java Checkstyle'
);
await check(python, ['-m', 'ruff', 'check', 'deploy', 'scripts', 'tools'], 'Python Ruff lint');
await check(
  process.execPath,
  ['scripts/quality/setup-native-tools.mjs'],
  'Pinned native tool setup'
);
await check(npm, ['run', 'test:quality:tools'], 'Language linter positive/negative fixtures');
const shellFiles = [
  ...(await findFiles('apps/collector/ops', ['.sh'])),
  ...(await findFiles('deploy', ['.sh'])),
  ...(await findFiles('scripts', ['.sh'])),
  ...(await findFiles('tools', ['.sh'])),
  ...(await findFiles('tests', ['.sh'])),
];
requireNonEmptyScope('shell', shellFiles.length);
console.log(`[lint:all] scope shell: ${shellFiles.length} file(s)`);
await check(nativeTool('shellcheck'), ['--severity=style', ...shellFiles], 'ShellCheck');
await check(
  nativeTool('actionlint'),
  ['.github/workflows/ci.yml', '.github/workflows/backup-restore.yml'],
  'GitHub Actions actionlint'
);
await check(
  process.execPath,
  ['scripts/quality/lint-debt.mjs', '--check'],
  'SQL/CSS/Markdown/format lint baseline'
);

if (failures.length) {
  console.error(`\n[lint:all] ${failures.length} required check(s) failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else console.log('\n[lint:all] all configured language scopes passed');
