import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const workflow = parse(
  await readFile(resolve(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8')
);

test('CI runs full lint and architecture checks in the quality job', () => {
  const quality = workflow.jobs.quality;
  const commands = quality.steps.map((step) => step.run).filter(Boolean);
  assert.ok(commands.some((command) => command.includes('npm run lint:all')));
  assert.ok(commands.some((command) => command.includes('npm run test:architecture')));
  assert.ok(commands.some((command) => command.includes('npm run test:harness')));
});

test('same-SHA restore scope and applicable restore result are required by the final gate', () => {
  const scope = workflow.jobs['restore-scope'];
  assert.ok(scope.needs.includes('event-context'));
  assert.equal(scope.outputs.required, '${{ steps.classify.outputs.required }}');
  assert.equal(scope.outputs.core, '${{ steps.classify.outputs.core }}');
  assert.equal(scope.outputs.collector, '${{ steps.classify.outputs.collector }}');

  const restore = workflow.jobs['schema-restore'];
  assert.ok(restore.needs.includes('event-context'));
  assert.ok(restore.needs.includes('restore-scope'));
  assert.match(restore.if, /needs\.restore-scope\.outputs\.core == 'true'/);

  const gate = workflow.jobs['harness-gate'];
  assert.equal(gate.if, 'always()');
  for (const required of [
    'restore-scope',
    'schema-restore',
    'collector-schema-restore',
    'quality',
    'verify',
    'collector',
  ])
    assert.ok(gate.needs.includes(required), `${required} must be a gate dependency`);
  const gateCommands = gate.steps
    .map((step) => step.run)
    .filter(Boolean)
    .join('\n');
  assert.match(gateCommands, /test "\$RESTORE_SCOPE" = success/);
  assert.match(gateCommands, /if \[ "\$RESTORE_CORE" = true \]/);
  assert.match(gateCommands, /test "\$RESTORE" = success/);
  assert.match(gateCommands, /test "\$RESTORE" = skipped/);
  assert.match(gateCommands, /test "\$COLLECTOR_RESTORE" = success/);
  assert.match(gateCommands, /test "\$COLLECTOR_RESTORE" = skipped/);
  assert.ok(workflow.jobs.images.needs.includes('harness-gate'));
});

test('Collector migration changes select an isolated PostgreSQL dump and restore verifier', () => {
  const restore = workflow.jobs['collector-schema-restore'];
  assert.ok(restore.needs.includes('event-context'));
  assert.ok(restore.needs.includes('restore-scope'));
  assert.match(restore.if, /needs\.restore-scope\.outputs\.collector == 'true'/);
  assert.ok(restore.steps.some((step) => step.run?.includes('npm run test:collector:restore')));
  assert.ok(workflow.jobs['harness-gate'].needs.includes('collector-schema-restore'));
});

test('Windows lease regression is a required gate dependency', () => {
  const windows = workflow.jobs['windows-leases'];
  assert.ok(windows.needs.includes('event-context'));
  assert.ok(
    windows.steps.some((step) => step.run?.includes('node --test tests/harness/leases.test.mjs'))
  );
  assert.ok(workflow.jobs['harness-gate'].needs.includes('windows-leases'));
});
