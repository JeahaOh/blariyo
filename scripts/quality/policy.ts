export type Parser = 'exit' | 'node' | 'node-files' | 'unittest';
export interface Check {
  id: string;
  command: string;
  args: string[];
  parser: Parser;
}
const npm = (id: string, script: string, parser: Parser = 'exit'): Check => ({
  id, command: 'npm', args: ['run', script], parser,
});
export const profiles: Record<string, Check[]> = {
  quality: [
    { id: 'contracts', command: 'node', args: ['.githooks/check-contracts.mjs'], parser: 'exit' },
    npm('ci', 'test:ci', 'unittest'),
    npm('build', 'build'),
    { id: 'api-test-build', command: 'npm', args: ['run', 'build:test', '-w', '@blariyo/api'], parser: 'exit' },
    npm('types-scripts', 'typecheck:scripts'), npm('types-tests', 'typecheck:tests'),
    npm('types-web', 'typecheck:web'),
    npm('types-quality-rules', 'typecheck:quality-rules'),
    ...['api', 'web'].map((app): Check => ({
      id: `lint-${app}`, command: 'npm', args: ['run', 'lint', '-w', `@blariyo/${app}`], parser: 'exit',
    })),
    npm('lint-scripts', 'lint:scripts'), npm('lint-tests', 'lint:tests'),
    npm('lint-quality-rules', 'lint:quality-rules'),
    { id: 'unit', command: 'npm', args: ['test'], parser: 'node' },
  ],
  browser: [npm('browser', 'test:browser', 'node')],
  'browser-docker': [npm('browser-docker', 'test:browser:docker', 'node')],
  // The inventory runner executes every integration file and fails on the first
  // child failure. Each child emits its own complete Node test summary.
  api: [npm('api-integration', 'test:nest', 'node-files')],
};

// Worklog contains execution records, never executable quality policy. Git ignores
// exclude untracked build/runtime data; tracked files are always included.
export const excludedInputs = ['worklog/'];
export const unsupportedScopes = ['production', 'operator-acceptance', 'collector-junit'];

export function checksFor(profile: string): Check[] {
  if (!Object.hasOwn(profiles, profile)) throw new Error('UNKNOWN_PROFILE');
  const checks = profiles[profile];
  if (!checks) throw new Error('UNKNOWN_PROFILE');
  return checks;
}
