import { access, mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { git, gitTry } from './git.mjs';

function branchName(value) {
  return value.replace(/^refs\/heads\//, '');
}

export function classifyBranch(value) {
  const name = branchName(value);
  if (name === 'main' || name === 'develop') return { name, role: name };
  const feature = /^feature\/([A-Z][A-Z0-9]*-\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(name);
  if (feature) return { name, role: 'feature', taskId: feature[1], slug: feature[2] };
  const release = /^release\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(name);
  if (release) return { name, role: 'release', version: release[1] };
  const hotfix = /^hotfix\/([A-Z][A-Z0-9]*-\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(name);
  if (hotfix) return { name, role: 'hotfix', taskId: hotfix[1], slug: hotfix[2] };
  return { name, role: 'unknown' };
}

export async function validatePullRequest(headValue, baseValue, options = {}) {
  const policyPath = resolve(options.root ?? process.cwd(), '.harness/policy.json');
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  const head = classifyBranch(headValue);
  const base = classifyBranch(baseValue);
  if (head.role === 'unknown' || base.role === 'unknown')
    throw new Error(`unrecognized branch role: ${head.role === 'unknown' ? head.name : base.name}`);
  const branchPolicy = policy.branchRoles[head.role];
  if (!branchPolicy?.targets)
    throw new Error(`${head.role} is not a valid pull request source branch`);
  if (head.taskId) {
    const manifestPath = resolve(
      options.root ?? process.cwd(),
      policy.taskManifestDirectory,
      `${head.taskId}.json`
    );
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch {
      throw new Error(`task manifest for ${head.taskId} is missing or invalid`);
    }
    if (manifest.taskId !== head.taskId || !['active', 'in-progress'].includes(manifest.state))
      throw new Error(`task manifest for ${head.taskId} is mismatched or inactive`);
  }
  if (head.role === 'hotfix' && base.role === 'release' && policy.activeRelease !== base.name)
    throw new Error(
      `hotfix may target only the registered active release; ${base.name} is not registered active`
    );
  if (
    !branchPolicy.targets.includes(base.role) &&
    !(
      branchPolicy.targets.includes('active-release') &&
      head.role === 'hotfix' &&
      base.role === 'release' &&
      policy.activeRelease === base.name
    )
  )
    throw new Error(`${head.role} -> ${base.role} is not an allowed pull request direction`);
  return { head, base, allowed: true };
}

export async function startTask(taskId, slug, worktreePath, cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(taskId)) throw new Error('task ID format is invalid');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error('branch slug must be lowercase kebab-case');
  const policy = JSON.parse(await readFile(resolve(root, '.harness/policy.json'), 'utf8'));
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(policy.developBootstrapSha ?? ''))
    throw new Error('BLOCKED: policy developBootstrapSha must be a full Git object ID');
  const taskPath = resolve(root, policy.taskManifestDirectory, `${taskId}.json`);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(taskPath, 'utf8'));
  } catch {
    throw new Error(`task manifest for ${taskId} is missing or invalid`);
  }
  if (manifest.taskId !== taskId || !['active', 'in-progress'].includes(manifest.state))
    throw new Error(`task manifest for ${taskId} is mismatched or inactive`);

  const develop = gitTry(['show-ref', '--verify', '--quiet', 'refs/heads/develop'], { cwd: root });
  if (develop.status !== 0)
    throw new Error(
      'BLOCKED: develop branch is absent; choose/approve a migration baseline before creating work'
    );
  const remoteDevelop = gitTry(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/develop'], {
    cwd: root,
  });
  if (remoteDevelop.status !== 0)
    throw new Error(
      'BLOCKED: origin/develop is absent; fetch and verify the approved integration baseline before creating work'
    );
  const developSha = git(['rev-parse', 'refs/heads/develop'], { cwd: root }).trim();
  const bootstrap = gitTry(
    ['merge-base', '--is-ancestor', policy.developBootstrapSha, 'refs/heads/develop'],
    { cwd: root }
  );
  if (bootstrap.status !== 0)
    throw new Error(
      `BLOCKED: develop ${developSha} does not descend from approved bootstrap ${policy.developBootstrapSha}`
    );
  const remoteDevelopSha = git(['rev-parse', 'refs/remotes/origin/develop'], { cwd: root }).trim();
  if (developSha !== remoteDevelopSha)
    throw new Error(
      `BLOCKED: local develop ${developSha} differs from origin/develop ${remoteDevelopSha}; synchronize and review before creating work`
    );
  const name = `feature/${taskId}-${slug}`;
  const localCollision = gitTry(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], {
    cwd: root,
  });
  const remoteCollision = gitTry(
    ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${name}`],
    { cwd: root }
  );
  if (localCollision.status === 0 || remoteCollision.status === 0)
    throw new Error(`branch already exists: ${name}`);

  if (!isAbsolute(worktreePath)) throw new Error('worktree path must be absolute');
  const path = resolve(worktreePath);
  try {
    await access(path);
    throw new Error(`worktree path already exists: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const branchCount = git(['worktree', 'list', '--porcelain'], { cwd: root })
    .split(/\r?\n/)
    .filter((line) => line === `branch refs/heads/${name}`).length;
  if (branchCount) throw new Error(`branch is already attached to a worktree: ${name}`);

  await mkdir(resolve(path, '..'), { recursive: true });
  git(['worktree', 'add', '-b', name, path, 'develop'], { cwd: root });
  return {
    taskId,
    branch: name,
    baseRef: 'develop',
    baseSha: developSha,
    worktree: path,
  };
}

export async function startHotfix(taskId, slug, productionSha, worktreePath, cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(taskId)) throw new Error('task ID format is invalid');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error('branch slug must be lowercase kebab-case');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(productionSha ?? ''))
    throw new Error('BLOCKED: production SHA must be a full Git object ID');
  const policy = JSON.parse(await readFile(resolve(root, '.harness/policy.json'), 'utf8'));
  const taskPath = resolve(root, policy.taskManifestDirectory, `${taskId}.json`);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(taskPath, 'utf8'));
  } catch {
    throw new Error(`task manifest for ${taskId} is missing or invalid`);
  }
  if (manifest.taskId !== taskId || !['active', 'in-progress'].includes(manifest.state))
    throw new Error(`task manifest for ${taskId} is mismatched or inactive`);

  const main = gitTry(['show-ref', '--verify', '--quiet', 'refs/heads/main'], { cwd: root });
  if (main.status !== 0)
    throw new Error('BLOCKED: local main is absent; verify production ancestry first');
  const object = gitTry(['cat-file', '-e', `${productionSha}^{commit}`], { cwd: root });
  if (object.status !== 0)
    throw new Error(`BLOCKED: production commit is unavailable: ${productionSha}`);
  const ancestry = gitTry(['merge-base', '--is-ancestor', productionSha, 'refs/heads/main'], {
    cwd: root,
  });
  if (ancestry.status !== 0)
    throw new Error(`BLOCKED: production SHA ${productionSha} is not an ancestor of local main`);

  const name = `hotfix/${taskId}-${slug}`;
  for (const ref of [`refs/heads/${name}`, `refs/remotes/origin/${name}`])
    if (gitTry(['show-ref', '--verify', '--quiet', ref], { cwd: root }).status === 0)
      throw new Error(`branch already exists: ${name}`);
  if (!isAbsolute(worktreePath)) throw new Error('worktree path must be absolute');
  const path = resolve(worktreePath);
  try {
    await access(path);
    throw new Error(`worktree path already exists: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(resolve(path, '..'), { recursive: true });
  git(['worktree', 'add', '-b', name, path, productionSha], { cwd: root });
  return {
    taskId,
    branch: name,
    baseRef: 'production-sha',
    baseSha: productionSha,
    worktree: path,
  };
}
