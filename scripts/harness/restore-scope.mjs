import { git, gitTry } from './git.mjs';

const corePrefixes = [
  'apps/api/migrations/',
  'apps/api/src/commands/migrat',
  'apps/api/src/persistence/migrations.repository.ts',
  'apps/api/src/persistence/database.ts',
  'apps/api/src/bootstrap/database-config.ts',
  'deploy/backup/',
  'deploy/postgresql/',
  'docs/migration/',
];
const harnessFiles = new Set([
  'apps/api/test/schema-restore.integration.test.ts',
  'apps/api/test/migrations.integration.test.ts',
  'scripts/test-nest-integration.ts',
  '.github/workflows/ci.yml',
  '.github/workflows/backup-restore.yml',
  'scripts/harness/restore-scope.mjs',
]);
const collectorPrefix = 'apps/collector/src/main/resources/db/';

export function classifyRestoreChanges(paths) {
  const unique = [...new Set(paths)].sort();
  const collector = unique.filter((path) => path.startsWith(collectorPrefix));
  const core = unique.filter(
    (path) => corePrefixes.some((prefix) => path.startsWith(prefix)) || harnessFiles.has(path)
  );
  return {
    required: core.length > 0 || collector.length > 0,
    supported: true,
    core: core.length > 0,
    collector,
    paths: unique,
  };
}

export function changedPaths(base, head, cwd = process.cwd()) {
  const zero = /^0+$/.test(base ?? '');
  if (!head || gitTry(['cat-file', '-e', `${head}^{commit}`], { cwd }).status !== 0)
    throw new Error('restore scope head commit is unavailable');
  if (zero) return git(['ls-tree', '-r', '--name-only', head], { cwd }).split('\n').filter(Boolean);
  if (gitTry(['cat-file', '-e', `${base}^{commit}`], { cwd }).status !== 0)
    throw new Error('restore scope base commit is unavailable; fetch complete history');
  if (git(['rev-parse', '--is-shallow-repository'], { cwd }).trim() === 'true')
    throw new Error('restore scope cannot be proven in a shallow checkout');
  return git(['diff', '--name-only', '-z', base, head], { cwd }).split('\0').filter(Boolean);
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  try {
    const [base, head] = process.argv.slice(2);
    if (!head) throw new Error('usage: restore-scope.mjs <base-sha|zero-oid> <head-sha>');
    const result = classifyRestoreChanges(changedPaths(base, head));
    console.log(`required=${result.required}`);
    console.log(`core=${result.core}`);
    console.log(`collector=${result.collector.length > 0}`);
    console.log(`classifiedPaths=${result.paths.length}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
