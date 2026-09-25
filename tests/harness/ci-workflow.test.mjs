import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { buildJobReceipt } from '../../scripts/harness/job-receipt.mjs';

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

function gateEnvironment(changes = {}) {
  return {
    ...process.env,
    EVENT_CONTEXT: 'success',
    EVENT_NAME: 'pull_request',
    CONTEXT_SHA256: 'a'.repeat(64),
    BINDINGS_SHA256: 'b'.repeat(64),
    QUALITY: 'success',
    WINDOWS_LEASES: 'success',
    VERIFY: 'success',
    COLLECTOR: 'success',
    RESTORE_SCOPE: 'success',
    RESTORE_REQUIRED: 'false',
    RESTORE_CORE: 'false',
    RESTORE_COLLECTOR: 'false',
    RESTORE: 'skipped',
    COLLECTOR_RESTORE: 'skipped',
    ...changes,
  };
}

function runWorkflowStep(step, env) {
  return spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run], {
    env,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('missing, cancelled, or failed context leaves diagnostics but never valid verification evidence', async (t) => {
  const gate = workflow.jobs['harness-gate'];
  const check = gate.steps.find((step) => step.name === 'Require all applicable checks');
  const diagnostic = gate.steps.find(
    (step) => step.name === 'Record final harness gate diagnostic'
  );
  const receipt = gate.steps.find((step) => step.name === 'Record final harness gate receipt');
  const diagnosticUpload = gate.steps.find((step) =>
    step.with?.name?.startsWith('ci-diagnostic-harness-gate-')
  );
  const receiptUpload = gate.steps.find((step) =>
    step.with?.name?.startsWith('ci-receipt-harness-gate-')
  );
  assert.equal(diagnostic.if, 'always()');
  assert.equal(diagnosticUpload.if, 'always()');
  assert.equal(receipt.if, "always() && needs.event-context.result == 'success'");
  assert.equal(receiptUpload.if, receipt.if);
  assert.ok(gate.steps.indexOf(diagnosticUpload) < gate.steps.indexOf(receipt));
  assert.equal(diagnosticUpload.with['if-no-files-found'], 'error');
  assert.equal(receiptUpload.with['if-no-files-found'], 'error');
  assert.equal(diagnosticUpload.with.path, '${{ runner.temp }}/harness-gate-diagnostic.json');
  assert.equal(receiptUpload.with.path, '${{ runner.temp }}/harness-gate-receipt.json');

  const root = await mkdtemp(resolve(tmpdir(), 'harness-gate-diagnostic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const context of ['failure', 'cancelled', 'skipped', '', 'success']) {
    const env = gateEnvironment({
      RUNNER_TEMP: root,
      JOB_NAME: 'harness-gate',
      JOB_STATUS: 'failure',
      GITHUB_RUN_ID: '123456',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_SHA: 'c'.repeat(40),
      EVENT_CONTEXT: context,
      EVENT_NAME: '',
      SUBJECT_SHA: '',
      CONTEXT_SHA256: '',
      BINDINGS_SHA256: '',
      QUALITY: 'skipped',
      WINDOWS_LEASES: 'skipped',
      VERIFY: 'skipped',
      COLLECTOR: 'skipped',
      RESTORE_SCOPE: 'skipped',
      RESTORE_REQUIRED: '',
      RESTORE_CORE: '',
      RESTORE_COLLECTOR: '',
      PRIVATE_DIAGNOSTIC_SENTINEL: 'must-never-appear-in-artifact',
    });
    assert.equal(runWorkflowStep(check, env).status, 1, context);
    const result = runWorkflowStep(diagnostic, env);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const raw = await readFile(resolve(root, 'harness-gate-diagnostic.json'), 'utf8');
    const record = JSON.parse(raw);
    assert.equal(record.recordType, 'ci-gate-diagnostic');
    assert.equal(record.verificationEvidence, false);
    assert.equal(record.result, 'failure');
    assert.equal(record.job, 'harness-gate');
    assert.deepEqual(record.run, { id: '123456', attempt: '2', event: 'pull_request' });
    assert.equal(record.eventSha, 'c'.repeat(40));
    assert.equal(record.jobs.eventContext, context);
    assert.equal(record.jobs.quality, 'skipped');
    assert.equal(Object.keys(record.jobs).length, gate.needs.length);
    assert.deepEqual(record.restore, { required: null, core: null, collector: null });
    assert.equal('subjectSha' in record, false);
    assert.equal('receiptType' in record, false);
    assert.equal(raw.includes(env.PRIVATE_DIAGNOSTIC_SENTINEL), false);
    assert.throws(() => buildJobReceipt(env), /inputs missing/);
  }
});

test('executed final gate still requires every mandatory job and the exact restore outcome', () => {
  const gate = workflow.jobs['harness-gate'];
  const check = gate.steps.find((step) => step.name === 'Require all applicable checks');
  assert.equal(runWorkflowStep(check, gateEnvironment()).status, 0);
  for (const job of [
    'EVENT_CONTEXT',
    'QUALITY',
    'WINDOWS_LEASES',
    'VERIFY',
    'COLLECTOR',
    'RESTORE_SCOPE',
  ]) {
    for (const status of ['failure', 'cancelled', 'skipped']) {
      assert.equal(
        runWorkflowStep(check, gateEnvironment({ [job]: status })).status,
        1,
        `${job}: ${status}`
      );
    }
  }
  for (const key of [
    'EVENT_NAME',
    'CONTEXT_SHA256',
    'BINDINGS_SHA256',
    'RESTORE_REQUIRED',
    'RESTORE_CORE',
    'RESTORE_COLLECTOR',
  ]) {
    assert.equal(runWorkflowStep(check, gateEnvironment({ [key]: '' })).status, 1, key);
  }
  const required = {
    RESTORE_REQUIRED: 'true',
    RESTORE_CORE: 'true',
    RESTORE_COLLECTOR: 'true',
    RESTORE: 'success',
    COLLECTOR_RESTORE: 'success',
  };
  assert.equal(runWorkflowStep(check, gateEnvironment(required)).status, 0);
  for (const job of ['RESTORE', 'COLLECTOR_RESTORE']) {
    assert.equal(
      runWorkflowStep(check, gateEnvironment({ ...required, [job]: 'skipped' })).status,
      1,
      job
    );
    assert.equal(runWorkflowStep(check, gateEnvironment({ [job]: 'success' })).status, 1, job);
  }
});
