import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { git, gitTry } from './git.mjs';

const zeroOid = /^0+$/;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fullOid(value, label) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value ?? ''))
    throw new Error(`${label} must be a full Git object ID`);
  return value;
}

function parseEvent(event, env) {
  if (event_name(event, env) === 'pull_request') {
    const pr = event.pull_request;
    if (!pr || !Number.isInteger(pr.number))
      throw new Error('pull_request event payload is incomplete');
    return {
      eventName: 'pull_request',
      eventId: `pr-${pr.number}`,
      baseSha: fullOid(pr.base?.sha, 'pull request base SHA'),
      headSha: fullOid(pr.head?.sha, 'pull request head SHA'),
      subjectSha: fullOid(env.GITHUB_SHA, 'GitHub subject SHA'),
      subjectKind: 'merge-result',
      beforeSha: null,
      ref: pr.base?.ref,
    };
  }
  if (event_name(event, env) === 'push') {
    const before = event.before;
    if (zeroOid.test(before ?? ''))
      throw new Error(
        'new ref push has no trusted comparison base; validate through a pull request or provide a governed baseline'
      );
    return {
      eventName: 'push',
      eventId: event.after,
      baseSha: fullOid(before, 'push before SHA'),
      headSha: fullOid(event.after, 'push after SHA'),
      subjectSha: fullOid(env.GITHUB_SHA, 'GitHub subject SHA'),
      subjectKind: 'commit',
      beforeSha: fullOid(before, 'push before SHA'),
      ref: event.ref,
    };
  }
  if (event_name(event, env) === 'workflow_dispatch') {
    const baseSha = fullOid(event.inputs?.base_sha, 'manual workflow base_sha input');
    return {
      eventName: 'workflow_dispatch',
      eventId: `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`,
      baseSha,
      headSha: fullOid(env.GITHUB_SHA, 'GitHub subject SHA'),
      subjectSha: fullOid(env.GITHUB_SHA, 'GitHub subject SHA'),
      subjectKind: 'commit',
      beforeSha: null,
      ref: env.GITHUB_REF,
      purpose: event.inputs?.purpose ?? null,
    };
  }
  throw new Error(`unsupported GitHub event: ${event_name(event, env) || '(missing)'}`);
}

function event_name(event, env) {
  return env.GITHUB_EVENT_NAME ?? event.event_name ?? '';
}

function commitIds(baseSha, headSha, cwd) {
  if (git(['rev-parse', '--is-shallow-repository'], { cwd }).trim() === 'true')
    throw new Error('CI task binding requires complete Git history');
  return git(['rev-list', '--reverse', '--topo-order', `${baseSha}..${headSha}`], { cwd })
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function trailers(message) {
  const taskIds = [...message.matchAll(/^Task-Id:\s*([A-Z][A-Z0-9]*-\d+)\s*$/gim)].map(
    (match) => match[1]
  );
  const changeIds = [...message.matchAll(/^Change-Id:\s*([0-9a-f-]{36})\s*$/gim)].map((match) =>
    match[1].toLowerCase()
  );
  if (taskIds.length !== 1 || changeIds.length !== 1)
    throw new Error(
      'every non-merge commit in the event range must have exactly one Task-Id and Change-Id trailer'
    );
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(changeIds[0]))
    throw new Error('commit Change-Id must be a UUIDv4');
  return { taskId: taskIds[0], changeId: changeIds[0] };
}

function taskManifest(headSha, taskId, manifestDirectory, cwd) {
  const path = `${manifestDirectory}/${taskId}.json`;
  let manifest;
  try {
    manifest = JSON.parse(git(['show', `${headSha}:${path}`], { cwd }));
  } catch {
    throw new Error(`task manifest ${path} is missing or invalid at the event head`);
  }
  if (manifest.taskId !== taskId || !['active', 'in-progress'].includes(manifest.state))
    throw new Error(`task manifest ${taskId} is mismatched or inactive at the event head`);
  if (
    !Array.isArray(manifest.changeIds) ||
    manifest.changeIds.some(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    )
  )
    throw new Error(`task manifest ${taskId} must register UUIDv4 changeIds`);
  if (new Set(manifest.changeIds.map((id) => id.toLowerCase())).size !== manifest.changeIds.length)
    throw new Error(`task manifest ${taskId} contains duplicate changeIds`);
  const registered = new Set(manifest.changeIds.map((id) => id.toLowerCase()));
  return { hash: sha256(git(['show', `${headSha}:${path}`], { cwd })), registered };
}

export function buildCiContext(event, env = process.env, cwd = process.cwd()) {
  const input = parseEvent(event, env);
  if (input.eventName !== 'pull_request') {
    const ancestry = gitTry(['merge-base', '--is-ancestor', input.baseSha, input.headSha], { cwd });
    if (ancestry.status !== 0)
      throw new Error('comparison base is not an ancestor of the event head');
  }
  if (input.subjectSha !== input.headSha && input.subjectKind !== 'merge-result')
    throw new Error('event subject SHA does not match its head SHA');
  const basePolicyText = git(['show', `${input.baseSha}:.harness/policy.json`], { cwd });
  const policy = JSON.parse(basePolicyText);
  if (policy.taskManifestDirectory !== '.harness/tasks')
    throw new Error('trusted base policy has an unsupported task manifest directory');
  const commits = commitIds(input.baseSha, input.headSha, cwd);
  if (commits.length === 0) throw new Error('event range contains no commits to bind');
  const objects = git(['rev-list', '--objects', `${input.baseSha}..${input.headSha}`], { cwd })
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const bindingMap = new Map();
  for (const commitSha of commits) {
    const parents = git(['rev-list', '--parents', '-n', '1', commitSha], { cwd })
      .trim()
      .split(/\s+/)
      .slice(1);
    if (parents.length > 1) continue;
    const message = git(['show', '-s', '--format=%B', commitSha], { cwd });
    const { taskId, changeId } = trailers(message);
    const { hash: taskManifestHash, registered } = taskManifest(
      input.headSha,
      taskId,
      policy.taskManifestDirectory,
      cwd
    );
    if (!registered.has(changeId))
      throw new Error(`change ${changeId} is not registered in task manifest ${taskId}`);
    const key = `${taskId}\0${changeId}`;
    if (!bindingMap.has(key))
      bindingMap.set(key, { taskId, changeId, taskManifestHash, commitShas: [] });
    const binding = bindingMap.get(key);
    if (binding.taskManifestHash !== taskManifestHash)
      throw new Error(`task manifest changed within bound change ${changeId}`);
    binding.commitShas.push(commitSha);
  }
  if (bindingMap.size === 0)
    throw new Error('event range contains no task-bound non-merge commits');
  const bindings = [...bindingMap.values()].sort((a, b) =>
    `${a.taskId}:${a.changeId}`.localeCompare(`${b.taskId}:${b.changeId}`)
  );
  const runId = env.GITHUB_RUN_ID;
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  if (!runId || !Number.isInteger(attempt) || attempt < 1)
    throw new Error('GitHub run ID and positive attempt are required');
  const workspaceHash = sha256(
    `${env.GITHUB_REPOSITORY}\0${runId}\0${attempt}\0${env.GITHUB_WORKSPACE ?? ''}`
  ).slice(0, 24);
  const context = {
    schemaVersion: 1,
    producer: 'ci',
    eventId: input.eventId,
    event: input.eventName,
    executionContext: {
      kind: input.eventName === 'workflow_dispatch' ? 'manual' : 'ci',
      event: input.eventName,
      providerRunId: runId,
      jobId: 'event-context',
      attempt,
      checkoutId: workspaceHash,
    },
    subjectKind: input.subjectKind,
    subjectSha: input.subjectSha,
    baseSha: input.baseSha,
    headSha: input.headSha,
    beforeSha: input.beforeSha,
    ref: input.ref ?? null,
    purpose: input.purpose ?? null,
    policyHash: sha256(basePolicyText),
    historyRange: {
      refs: [input.ref ?? input.eventName],
      commitSetHash: sha256(commits.join('\n')),
      objectSetHash: sha256(objects.join('\n')),
      objectCount: commits.length,
    },
    changeBindings: bindings,
  };
  context.contextSha256 = sha256(JSON.stringify(context));
  context.bindingsSha256 = sha256(JSON.stringify(bindings));
  return context;
}

export async function writeCiContext(
  eventPath,
  outputPath,
  env = process.env,
  cwd = process.cwd()
) {
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const context = buildCiContext(event, env, cwd);
  await writeFile(outputPath, `${JSON.stringify(context, null, 2)}\n`, { mode: 0o600, flag: 'w' });
  if (env.GITHUB_OUTPUT) {
    await appendFile(
      env.GITHUB_OUTPUT,
      [
        `subject_sha=${context.subjectSha}`,
        `context_sha256=${context.contextSha256}`,
        `bindings_sha256=${context.bindingsSha256}`,
        `base_sha=${context.baseSha}`,
        `head_sha=${context.headSha}`,
        `event_name=${context.event}`,
      ].join('\n') + '\n'
    );
  }
  return context;
}
