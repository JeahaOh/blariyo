import { readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';

const SHA = /^[a-f0-9]{40}$/i;
const DIGEST = /^sha256:[a-f0-9]{64}$/i;
const HASH = /^[a-f0-9]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`);
  return value;
}

function requireTimestamp(value, name, now) {
  requireString(value, name);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value))
    throw new Error(`${name} must be an RFC3339 timestamp with timezone`);
  if (time > now) throw new Error(`${name} is in the future`);
  return time;
}

function verifyEvidence(name, evidence, candidateSha, scopeFrozenAt, now, expectedStatus) {
  if (!evidence || typeof evidence !== 'object') throw new Error(`${name} evidence is required`);
  if (evidence.status !== expectedStatus)
    throw new Error(`${name} status must be ${expectedStatus}`);
  if (
    !SHA.test(evidence.subjectSha ?? '') ||
    evidence.subjectSha.toLowerCase() !== candidateSha.toLowerCase()
  )
    throw new Error(`${name} evidence is bound to a different candidate SHA`);
  const observedAt = requireTimestamp(evidence.observedAt, `${name}.observedAt`, now);
  if (observedAt < scopeFrozenAt)
    throw new Error(`${name} evidence predates the frozen release scope`);
  requireString(evidence.evidenceRef, `${name}.evidenceRef`);
  if (!HASH.test(evidence.artifactSha256 ?? ''))
    throw new Error(`${name}.artifactSha256 must be a SHA-256 hash`);
  return {
    name,
    status: evidence.status,
    subjectSha: evidence.subjectSha,
    observedAt: new Date(observedAt).toISOString(),
  };
}

export function validateReleaseEvidence(
  manifest,
  { maxBackupAgeHours, now = Date.now(), registeredChangeIds } = {}
) {
  if (manifest?.schemaVersion !== 1) throw new Error('release manifest schemaVersion must be 1');
  const version = requireString(manifest.releaseVersion, 'releaseVersion');
  if (manifest.releaseBranch !== `release/${version}`)
    throw new Error('releaseBranch must match releaseVersion');
  if (!SHA.test(manifest.candidateSha ?? ''))
    throw new Error('candidateSha must be a 40-character Git SHA');
  const candidateSha = manifest.candidateSha.toLowerCase();
  const frozenAt = requireTimestamp(manifest.scopeFrozenAt, 'scopeFrozenAt', now);
  if (
    !Array.isArray(manifest.changeIds) ||
    manifest.changeIds.length === 0 ||
    manifest.changeIds.some((id) => !UUID.test(id))
  )
    throw new Error('changeIds must contain one or more registered UUIDs');
  if (!Array.isArray(manifest.taskBindings) || manifest.taskBindings.length === 0)
    throw new Error('taskBindings must map every release Change-Id to a registered task');
  const mappedChangeIds = manifest.taskBindings.map((binding) => binding.changeId).sort();
  if (
    mappedChangeIds.some((id) => !UUID.test(id)) ||
    new Set(mappedChangeIds).size !== mappedChangeIds.length
  )
    throw new Error('taskBindings contains malformed or duplicate Change-Ids');
  if (mappedChangeIds.join('\0') !== [...manifest.changeIds].sort().join('\0'))
    throw new Error('taskBindings must map the release scope exactly to changeIds');
  if (
    !Array.isArray(registeredChangeIds) ||
    manifest.changeIds.some((id) => !registeredChangeIds.includes(id))
  )
    throw new Error('one or more Change-Ids are absent from the candidate task manifests');
  if (!Number.isFinite(maxBackupAgeHours) || maxBackupAgeHours <= 0)
    throw new Error('maxBackupAgeHours must be supplied as a positive value');

  const evidence = manifest.evidence ?? {};
  const checks = [
    verifyEvidence('ci', evidence.ci, candidateSha, frozenAt, now, 'success'),
    verifyEvidence('quality', evidence.quality, candidateSha, frozenAt, now, 'success'),
    verifyEvidence('architecture', evidence.architecture, candidateSha, frozenAt, now, 'success'),
    verifyEvidence('image', evidence.image, candidateSha, frozenAt, now, 'built'),
    verifyEvidence('database', evidence.database, candidateSha, frozenAt, now, 'compatible'),
    verifyEvidence(
      'backupRestore',
      evidence.backupRestore,
      candidateSha,
      frozenAt,
      now,
      'verified'
    ),
  ];

  if (!DIGEST.test(evidence.image.digest ?? ''))
    throw new Error('image.digest must be a sha256 container digest');
  const backupAt = requireTimestamp(
    evidence.backupRestore.backupCreatedAt,
    'backupRestore.backupCreatedAt',
    now
  );
  const backupAge = now - backupAt;
  if (backupAge > maxBackupAgeHours * 60 * 60 * 1000)
    throw new Error('backupRestore evidence is stale');
  if (backupAt > Date.parse(evidence.backupRestore.observedAt))
    throw new Error('backupRestore observation predates its backup');
  requireString(evidence.database.schemaRevision, 'database.schemaRevision');
  requireString(evidence.backupRestore.environment, 'backupRestore.environment');

  const rollback = manifest.rollback;
  if (!rollback || !SHA.test(rollback.targetSha ?? ''))
    throw new Error('rollback.targetSha must be a Git SHA');
  if (!DIGEST.test(rollback.imageDigest ?? ''))
    throw new Error('rollback.imageDigest must be a sha256 container digest');
  if (rollback.targetSha.toLowerCase() === candidateSha)
    throw new Error('rollback target must identify a different commit');

  return {
    schemaVersion: 1,
    result: 'CONSISTENT',
    verificationLevel: 'submitted-evidence-cross-check',
    releaseVersion: version,
    releaseBranch: manifest.releaseBranch,
    candidateSha,
    candidateImageDigest: evidence.image.digest,
    rollbackTargetSha: rollback.targetSha.toLowerCase(),
    backupAgeHours: Number((backupAge / 3_600_000).toFixed(2)),
    checks,
    limitations: [
      'Evidence references and artifact hashes were cross-checked as submitted; remote provider records and artifact contents were not fetched or independently verified.',
    ],
  };
}

export async function checkReleaseManifest(path, options) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read release manifest: ${error.message}`);
  }
  const cwd = options?.cwd ?? process.cwd();
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  for (const [name, sha] of [
    ['candidate', manifest.candidateSha],
    ['rollback target', manifest.rollback?.targetSha],
  ]) {
    if (!SHA.test(sha ?? '')) throw new Error(`${name} SHA is malformed`);
    const commit = spawnSync('git', ['cat-file', '-e', `${sha.toLowerCase()}^{commit}`], {
      cwd: root,
      encoding: 'utf8',
    });
    if (commit.status !== 0) throw new Error(`${name} commit is unavailable in this repository`);
  }
  const registeredChangeIds = new Set();
  for (const binding of manifest.taskBindings ?? []) {
    if (!/^[A-Z][A-Z0-9]*-\d+$/.test(binding.taskId ?? ''))
      throw new Error('taskBindings contains an invalid task ID');
    let task;
    try {
      const taskJson = execFileSync(
        'git',
        ['show', `${manifest.candidateSha.toLowerCase()}:.harness/tasks/${binding.taskId}.json`],
        {
          cwd: root,
          encoding: 'utf8',
        }
      );
      task = JSON.parse(taskJson);
    } catch {
      throw new Error(`task manifest ${binding.taskId} is missing at candidate SHA`);
    }
    if (
      task.taskId !== binding.taskId ||
      !Array.isArray(task.changeIds) ||
      !task.changeIds.includes(binding.changeId)
    )
      throw new Error(
        `Change-Id ${binding.changeId} is not registered by ${binding.taskId} at candidate SHA`
      );
    registeredChangeIds.add(binding.changeId);
  }
  return validateReleaseEvidence(manifest, {
    ...options,
    registeredChangeIds: [...registeredChangeIds],
  });
}
