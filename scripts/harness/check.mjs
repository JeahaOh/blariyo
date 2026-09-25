import { git, gitTry } from './git.mjs';
import { looksBinary, secretKinds } from './secrets.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyBranch } from './branches.mjs';

export function repositoryRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).trim();
}

function stagedPaths(cwd) {
  const fields = git(['diff', '--cached', '--name-status', '-z', '--no-renames'], { cwd })
    .split('\0')
    .filter(Boolean);
  const changed = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (status && path) changed.push({ status: status[0], path });
  }
  return changed;
}

function allowedPath(path, patterns) {
  return patterns.some((pattern) => {
    if (typeof pattern !== 'string' || pattern.startsWith('/') || pattern.split('/').includes('..'))
      return false;
    let regex = '^';
    for (let index = 0; index < pattern.length; index += 1) {
      const char = pattern[index];
      if (char === '*' && pattern[index + 1] === '*') {
        regex += '.*';
        index += 1;
      } else if (char === '*') regex += '[^/]*';
      else regex += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
    return new RegExp(`${regex}$`).test(path);
  });
}

export function checkTaskRange(branchName, baseOid, headOid, cwd = process.cwd()) {
  const root = repositoryRoot(cwd);
  const role = classifyBranch(branchName);
  if (!['feature', 'hotfix'].includes(role.role)) return { checked: false, paths: 0 };
  validateOid(baseOid, 'task range base');
  validateOid(headOid, 'task range head');
  if (git(['rev-parse', '--is-shallow-repository'], { cwd: root }).trim() === 'true')
    throw new Error('task path range cannot be proven in a shallow checkout');
  const paths = git(['diff', '--name-only', '-z', '--no-renames', baseOid, headOid], { cwd: root })
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ path }));
  if (
    paths.some(({ path }) => path === '.harness/policy.json' || path.startsWith('.harness/tasks/'))
  )
    throw new Error('branch policy and task manifest edits require a separate governance review');
  let policy;
  try {
    policy = JSON.parse(git(['show', `${baseOid}:.harness/policy.json`], { cwd: root }));
  } catch {
    throw new Error('trusted base branch policy is missing or invalid');
  }
  if (policy.taskManifestDirectory !== '.harness/tasks')
    throw new Error('trusted policy task manifest directory must be .harness/tasks');
  let manifest;
  try {
    manifest = JSON.parse(
      git(['show', `${baseOid}:${policy.taskManifestDirectory}/${role.taskId}.json`], { cwd: root })
    );
  } catch {
    throw new Error(`task manifest for ${role.taskId} is absent from the trusted base`);
  }
  validateTaskPaths(role.taskId, paths, root, manifest);
  return { checked: true, paths: paths.length, taskId: role.taskId };
}

function validateTaskPaths(taskId, paths, root, suppliedManifest = undefined) {
  let manifest = suppliedManifest;
  if (!manifest) {
    const policy = JSON.parse(readFileSync(resolve(root, '.harness/policy.json'), 'utf8'));
    if (policy.taskManifestDirectory !== '.harness/tasks')
      throw new Error('task manifest directory must be .harness/tasks');
    const manifestPath = resolve(root, policy.taskManifestDirectory, `${taskId}.json`);
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new Error(`task manifest for ${taskId} is missing or invalid`);
    }
  }
  if (
    manifest.taskId !== taskId ||
    !['active', 'in-progress'].includes(manifest.state) ||
    !Array.isArray(manifest.allowedPaths) ||
    manifest.allowedPaths.length === 0
  )
    throw new Error(`task ${taskId} is mismatched, inactive, or has no path policy`);
  if (manifest.allowedPaths.some((pattern) => ['*', '**', '**/*'].includes(pattern)))
    throw new Error(`task ${taskId} path policy is too broad`);
  const outside = paths
    .filter(({ path }) => !allowedPath(path, manifest.allowedPaths))
    .map(({ path }) => path);
  if (outside.length)
    throw new Error(`path outside task ${taskId} allowlist: ${outside.join(', ')}`);
}

async function enforceTaskPaths(root, paths) {
  const branch = gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim();
  const role = classifyBranch(branch);
  if (!['feature', 'hotfix'].includes(role.role)) return;
  validateTaskPaths(role.taskId, paths, root);
}

function inspectBlob(cwd, objectSpec, displayPath, commit = undefined) {
  const result = gitTry(['show', objectSpec], { cwd });
  if (result.status !== 0) throw new Error(`cannot read protected Git object at ${displayPath}`);
  const bytes = Buffer.from(result.stdout, 'utf8');
  if (looksBinary(bytes)) return;
  const found = secretKinds(result.stdout);
  if (found.length) {
    const where = commit ? `${commit.slice(0, 12)}:${displayPath}` : displayPath;
    throw new Error(`secret candidate (${found.join(', ')}) in ${where}; contents were suppressed`);
  }
}

export async function checkStaged(cwd = process.cwd()) {
  const root = repositoryRoot(cwd);
  const whitespace = gitTry(['diff', '--cached', '--check'], { cwd: root });
  if (whitespace.status !== 0)
    throw new Error(whitespace.stdout || whitespace.stderr || 'staged whitespace check failed');
  const paths = stagedPaths(root);
  await enforceTaskPaths(root, paths);
  for (const { path, status } of paths) if (status !== 'D') inspectBlob(root, `:0:${path}`, path);
  return { root, stagedPaths: paths.length, scanned: paths.length };
}

function isZeroOid(value) {
  return /^0+$/.test(value);
}

function validateOid(value, label) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value ?? ''))
    throw new Error(`${label} must be a full Git object ID`);
}

function commitObject(cwd, oid) {
  const type = gitTry(['cat-file', '-t', oid], { cwd });
  if (type.status !== 0)
    throw new Error(
      `cannot read pushed object ${oid.slice(0, 12)}; fetch complete history before retrying`
    );
  if (type.stdout.trim() === 'tag') {
    const tag = git(['cat-file', '-p', oid], { cwd });
    const annotation = tag.split(/\r?\n\r?\n/, 2)[1] ?? '';
    const kinds = secretKinds(annotation);
    if (kinds.length)
      throw new Error(
        `secret candidate (${kinds.join(', ')}) in annotated tag; contents were suppressed`
      );
    const peeled = gitTry(['rev-parse', `${oid}^{commit}`], { cwd });
    if (peeled.status !== 0)
      throw new Error(`pushed tag ${oid.slice(0, 12)} does not resolve to a commit`);
    return peeled.stdout.trim();
  }
  if (type.stdout.trim() !== 'commit')
    throw new Error(`pushed object ${oid.slice(0, 12)} is not a commit or annotated tag`);
  return oid;
}

function pathsChangedInCommit(cwd, commit) {
  const fields = git(
    [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '-m',
      '-r',
      '--name-status',
      '-z',
      '--no-renames',
      commit,
    ],
    { cwd }
  )
    .split('\0')
    .filter(Boolean);
  const changed = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (!status || !path) throw new Error(`cannot parse changed paths for commit ${commit}`);
    changed.push({ status: status[0], path });
  }
  return changed;
}

export function checkOutgoingRefs(input, cwd = process.cwd()) {
  const root = repositoryRoot(cwd);
  const lines = input.split(/\r?\n/).filter((line) => line.trim());
  const policy = JSON.parse(readFileSync(resolve(root, '.harness/policy.json'), 'utf8'));
  let scannedCommits = 0;
  const seen = new Set();
  const issues = [];

  for (const line of lines) {
    const [localRef, localOid, remoteRef, remoteOid] = line.trim().split(/\s+/);
    if (!localRef || !localOid || !remoteRef || !remoteOid) {
      issues.push('invalid pre-push ref input');
      continue;
    }
    if (isZeroOid(localOid)) {
      issues.push(`deleting remote ref ${remoteRef} is blocked by the local governance hook`);
      continue;
    }
    if (!remoteRef.startsWith('refs/heads/'))
      issues.push(
        `push to unsupported ref ${remoteRef} is blocked until tag/ref policy is registered`
      );
    const remoteBranch = remoteRef.startsWith('refs/heads/') ? classifyBranch(remoteRef) : null;
    if (remoteRef.startsWith('refs/heads/') && remoteBranch?.role === 'unknown')
      issues.push(
        `push to unrecognized branch ${remoteRef} is blocked; use the configured branch naming policy`
      );
    const refUnchanged = localOid === remoteOid;
    if (
      remoteBranch &&
      policy.branchRoles[remoteBranch.role]?.directPush === false &&
      !refUnchanged
    )
      issues.push(`direct push to ${remoteRef} is blocked; use a reviewed pull request`);
    if (!isZeroOid(remoteOid)) {
      const remoteExists = gitTry(['cat-file', '-e', `${remoteOid}^{commit}`], { cwd: root });
      if (remoteExists.status !== 0) {
        issues.push(`remote tip ${remoteOid.slice(0, 12)} is unavailable; fetch before retrying`);
        continue;
      }
      const fastForward = gitTry(['merge-base', '--is-ancestor', remoteOid, localOid], {
        cwd: root,
      });
      if (fastForward.status !== 0) issues.push(`non-fast-forward push to ${remoteRef} is blocked`);
    } else if (git(['rev-parse', '--is-shallow-repository'], { cwd: root }).trim() === 'true') {
      issues.push(
        'new-branch history cannot be proven in a shallow checkout; fetch full history before retrying'
      );
    }

    try {
      const range = isZeroOid(remoteOid) ? localOid : `${remoteOid}..${localOid}`;
      const commits = git(['rev-list', range], { cwd: root }).split(/\r?\n/).filter(Boolean);
      for (const rawCommit of commits) {
        const commit = commitObject(root, rawCommit);
        if (seen.has(commit)) continue;
        seen.add(commit);
        scannedCommits += 1;
        const message = git(['show', '-s', '--format=%B', commit], { cwd: root });
        const messageKinds = secretKinds(message);
        if (messageKinds.length)
          throw new Error(
            `secret candidate (${messageKinds.join(', ')}) in commit message ${commit.slice(0, 12)}; contents were suppressed`
          );
        for (const { status, path } of pathsChangedInCommit(root, commit))
          if (status !== 'D') inspectBlob(root, `${commit}:${path}`, path, commit);
      }
    } catch (error) {
      issues.push(error.message);
    }
  }
  if (issues.length) throw new Error([...new Set(issues)].join('; '));
  return { scannedCommits, scannedRefs: lines.length };
}

export function checkCommitRange(baseOid, headOid, cwd = process.cwd()) {
  const root = repositoryRoot(cwd);
  if (!isZeroOid(baseOid)) validateOid(baseOid, 'range base');
  validateOid(headOid, 'range head');
  const head = commitObject(root, headOid);
  const newBranch = isZeroOid(baseOid);
  let range = head;
  if (!newBranch) {
    const base = commitObject(root, baseOid);
    if (git(['rev-parse', '--is-shallow-repository'], { cwd: root }).trim() === 'true')
      throw new Error(
        'commit range cannot be proven in a shallow checkout; fetch full history before retrying'
      );
    range = `${base}..${head}`;
  } else if (git(['rev-parse', '--is-shallow-repository'], { cwd: root }).trim() === 'true') {
    throw new Error(
      'new-branch history cannot be proven in a shallow checkout; fetch full history before retrying'
    );
  }
  const commits = git(['rev-list', range], { cwd: root }).split(/\r?\n/).filter(Boolean);
  for (const rawCommit of commits) {
    const commit = commitObject(root, rawCommit);
    const message = git(['show', '-s', '--format=%B', commit], { cwd: root });
    const messageKinds = secretKinds(message);
    if (messageKinds.length)
      throw new Error(
        `secret candidate (${messageKinds.join(', ')}) in commit message ${commit.slice(0, 12)}; contents were suppressed`
      );
    for (const { status, path } of pathsChangedInCommit(root, commit))
      if (status !== 'D') inspectBlob(root, `${commit}:${path}`, path, commit);
  }
  return { scannedCommits: commits.length, base: newBranch ? null : baseOid, head: headOid };
}

export function readPrePushInput(stream = process.stdin) {
  return new Promise((resolve, reject) => {
    let input = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      input += chunk;
    });
    stream.on('end', () => resolve(input));
    stream.on('error', reject);
  });
}
