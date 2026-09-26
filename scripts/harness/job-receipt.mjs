import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { git } from './git.mjs';

const shaPattern = /^[0-9a-f]{40}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;

export function buildJobReceipt(env, cwd = process.cwd()) {
  const required = [
    'JOB_NAME',
    'JOB_STATUS',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
    'GITHUB_EVENT_NAME',
    'SUBJECT_SHA',
    'CONTEXT_SHA256',
    'BINDINGS_SHA256',
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`job receipt inputs missing: ${missing.join(', ')}`);
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(env.JOB_NAME))
    throw new Error('job receipt has invalid job name');
  if (!/^(success|failure|cancelled|skipped|unknown)$/.test(env.JOB_STATUS))
    throw new Error('job receipt has invalid result');
  if (!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID) || !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT))
    throw new Error('job receipt has invalid run identity');
  if (!shaPattern.test(env.SUBJECT_SHA)) throw new Error('job receipt has invalid subject SHA');
  if (!digestPattern.test(env.CONTEXT_SHA256) || !digestPattern.test(env.BINDINGS_SHA256))
    throw new Error('job receipt has invalid context digest');
  const checkoutSha = git(['rev-parse', 'HEAD'], { cwd }).trim();
  return {
    schemaVersion: 1,
    receiptType: 'ci-job',
    job: env.JOB_NAME,
    result: env.JOB_STATUS,
    run: {
      id: env.GITHUB_RUN_ID,
      attempt: Number(env.GITHUB_RUN_ATTEMPT),
      event: env.GITHUB_EVENT_NAME,
    },
    subjectSha: env.SUBJECT_SHA.toLowerCase(),
    checkoutSha,
    checkoutMatchesSubject: checkoutSha.toLowerCase() === env.SUBJECT_SHA.toLowerCase(),
    contextSha256: env.CONTEXT_SHA256.toLowerCase(),
    bindingsSha256: env.BINDINGS_SHA256.toLowerCase(),
    ...(env.RESTORE_REQUIRED === 'true' || env.RESTORE_REQUIRED === 'false'
      ? { restoreRequired: env.RESTORE_REQUIRED === 'true' }
      : {}),
    recordedAt: new Date().toISOString(),
  };
}

export async function writeJobReceipt(path, env = process.env, cwd = process.cwd()) {
  const receipt = buildJobReceipt(env, cwd);
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  return receipt;
}
