import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { git, gitTry } from './git.mjs';
import { classifyBranch } from './branches.mjs';

export function mergeBackTargets(source, policy) {
  const branch = classifyBranch(source);
  if (branch.role === 'release') return { branch, targets: ['main', 'develop'] };
  if (branch.role !== 'hotfix')
    throw new Error('merge-back check accepts only release or hotfix source branches');
  const targets = ['main', 'develop'];
  const activeRelease = policy?.activeRelease;
  if (activeRelease !== null && activeRelease !== undefined) {
    if (classifyBranch(activeRelease).role !== 'release')
      throw new Error('activeRelease must name a valid release/<version> branch');
    targets.push(activeRelease);
  }
  return { branch, targets };
}

export async function checkMergeBack(source, cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  let policy;
  try {
    policy = JSON.parse(await readFile(resolve(root, '.harness/policy.json'), 'utf8'));
  } catch (error) {
    throw new Error(`branch policy is missing or invalid: ${error.message}`);
  }
  const { branch, targets } = mergeBackTargets(source, policy);
  const sourceRef = `refs/heads/${branch.name}`;
  const sourceCheck = gitTry(['show-ref', '--verify', '--quiet', sourceRef], { cwd: root });
  if (sourceCheck.status !== 0) throw new Error(`source branch is missing: ${branch.name}`);
  const sourceSha = git(['rev-parse', sourceRef], { cwd: root }).trim();
  const results = targets.map((target) => {
    const targetRef = `refs/remotes/origin/${target}`;
    if (gitTry(['show-ref', '--verify', '--quiet', targetRef], { cwd: root }).status !== 0)
      return { target, state: 'MISSING_REMOTE_TRACKING_REF', sha: null };
    const sha = git(['rev-parse', targetRef], { cwd: root }).trim();
    const ancestry = gitTry(['merge-base', '--is-ancestor', sourceRef, targetRef], { cwd: root });
    if (ancestry.status > 1)
      throw new Error(
        `cannot prove ${branch.name} ancestry in ${target}: ${ancestry.stderr.trim()}`
      );
    return { target, state: ancestry.status === 0 ? 'MERGED' : 'NOT_MERGED', sha };
  });
  return {
    result: results.every((item) => item.state === 'MERGED') ? 'COMPLETE' : 'INCOMPLETE',
    verificationLevel: 'local-ref-ancestry-only',
    source: branch.name,
    sourceSha,
    targets: results,
    limitations: [
      'Refresh remote-tracking refs before this check; it reads local refs and does not query the provider.',
      'Ancestry does not prove deployment, CI success, branch protection, or release approval.',
    ],
  };
}
