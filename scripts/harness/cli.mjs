#!/usr/bin/env node
import {
  checkCommitRange,
  checkOutgoingRefs,
  checkStaged,
  checkTaskRange,
  readPrePushInput,
  repositoryRoot,
} from './check.mjs';
import { gitTry } from './git.mjs';
import { dispatchHook, installHooks, removeHooks } from './hooks.mjs';
import { startHotfix, startTask, validatePullRequest } from './branches.mjs';
import { handoffTask, inspectTaskResume, taskReady, verifyTask } from './verify.mjs';
import { writeCiContext } from './ci-context.mjs';
import { writeJobReceipt } from './job-receipt.mjs';
import { checkReleaseManifest } from './release.mjs';
import { acquireTaskLeases, inspectTaskLeases } from './leases.mjs';
import { taskLeaseSpec } from './verify.mjs';
import { checkMergeBack } from './merge-back.mjs';

async function main(args) {
  const [command, ...rest] = args;
  if (command === 'check' && rest[0] === '--staged') {
    const result = await checkStaged();
    console.log(`staged check passed (${result.scanned} path(s))`);
    return;
  }
  if (command === 'pre-push') {
    const input = await readPrePushInput();
    const result = checkOutgoingRefs(input);
    console.log(
      `outgoing history check passed (${result.scannedRefs} ref(s), ${result.scannedCommits} commit(s))`
    );
    return;
  }
  if (command === 'range' && rest.length === 2) {
    const result = checkCommitRange(rest[0], rest[1]);
    console.log(
      `commit range check passed (${result.scannedCommits} commit(s), ${result.base ?? 'new branch'}..${result.head})`
    );
    return;
  }
  if (command === 'task-range' && rest.length === 3) {
    const result = checkTaskRange(rest[0], rest[1], rest[2]);
    console.log(
      result.checked
        ? `task ${result.taskId} path check passed (${result.paths} path(s))`
        : 'task path check not applicable to this branch role'
    );
    return;
  }
  if (command === 'install-hooks') {
    const result = await installHooks();
    console.log(`hooks installed for ${result.worktree}`);
    return;
  }
  if (command === 'remove-hooks') {
    const result = await removeHooks();
    console.log(`hooks removed for ${result.root}; prior hooks path is active again`);
    return;
  }
  if (command === 'pr-policy' && rest.length === 2) {
    const result = await validatePullRequest(rest[0], rest[1]);
    console.log(`pull request direction allowed: ${result.head.role} -> ${result.base.role}`);
    return;
  }
  if (command === 'merge-back-check' && rest.length === 1) {
    const result = await checkMergeBack(rest[0]);
    console.log(JSON.stringify(result, null, 2));
    if (result.result !== 'COMPLETE') process.exitCode = 3;
    return;
  }
  if (command === 'start' && rest.length === 5 && rest[1] === '--slug' && rest[3] === '--path') {
    const [taskId, , slug, , worktreePath] = rest;
    if (!worktreePath)
      throw new Error('start requires --slug <value> --path <absolute-worktree-path>');
    const result = await startTask(taskId, slug, worktreePath);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (
    command === 'start-hotfix' &&
    rest.length === 7 &&
    rest[1] === '--slug' &&
    rest[3] === '--production-sha' &&
    rest[5] === '--path'
  ) {
    const [taskId, , slug, , productionSha, , worktreePath] = rest;
    const result = await startHotfix(taskId, slug, productionSha, worktreePath);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'verify' && rest.length === 1) {
    await verifyTask(rest[0]);
    return;
  }
  if (command === 'resume' && rest.length === 1) {
    const result = await inspectTaskResume(rest[0]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.canResume) process.exitCode = 3;
    return;
  }
  if (command === 'lease' && ['inspect', 'hold'].includes(rest[0]) && rest.length === 2) {
    const [action, taskId] = rest;
    const { root, resources } = await taskLeaseSpec(taskId);
    if (action === 'inspect') {
      console.log(JSON.stringify(await inspectTaskLeases(taskId, resources, root), null, 2));
      return;
    }
    const lease = await acquireTaskLeases(taskId, resources, root);
    console.log(
      JSON.stringify(
        {
          state: 'HELD',
          taskId,
          leaseId: lease.leaseId,
          locks: lease.locks,
          owner: lease.owner,
          release: 'press Ctrl-C in this process to release the lease',
        },
        null,
        2
      )
    );
    let signal = null;
    await new Promise((resolvePromise) => {
      const stop = (value) => {
        signal = value;
        resolvePromise();
      };
      process.once('SIGINT', () => stop('SIGINT'));
      process.once('SIGTERM', () => stop('SIGTERM'));
    });
    await lease.release();
    process.exitCode = signal === 'SIGINT' ? 130 : 0;
    return;
  }
  if (command === 'ready' && rest.length === 1) {
    const result = await taskReady(rest[0]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 3;
    return;
  }
  if (command === 'handoff' && rest.length === 1) {
    console.log(JSON.stringify(await handoffTask(rest[0]), null, 2));
    return;
  }
  if (command === 'ci-context' && rest.length === 2) {
    const result = await writeCiContext(rest[0], rest[1]);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'job-receipt' && rest.length === 1) {
    console.log(JSON.stringify(await writeJobReceipt(rest[0]), null, 2));
    return;
  }
  if (command === 'release-check' && rest.length === 3 && rest[1] === '--max-backup-age-hours') {
    const maxBackupAgeHours = Number(rest[2]);
    if (!Number.isFinite(maxBackupAgeHours) || maxBackupAgeHours <= 0)
      throw new Error('--max-backup-age-hours must be a positive number');
    console.log(
      JSON.stringify(await checkReleaseManifest(rest[0], { maxBackupAgeHours }), null, 2)
    );
    return;
  }
  if (command === 'hook' && rest.length >= 1) {
    const name = rest[0];
    const input = name === 'pre-push' ? await readPrePushInput() : undefined;
    await dispatchHook(name, rest.slice(1), input);
    return;
  }
  if (command === 'doctor') {
    const root = repositoryRoot();
    const branch =
      gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim() || '(detached)';
    const develop =
      gitTry(['show-ref', '--verify', '--quiet', 'refs/heads/develop'], { cwd: root }).status === 0;
    const hooksPath = gitTry(['config', '--worktree', '--get', 'core.hooksPath'], { cwd: root });
    const worktreeConfig = gitTry(['config', '--bool', '--get', 'extensions.worktreeConfig'], {
      cwd: root,
    });
    console.log(
      JSON.stringify(
        {
          repository: root,
          branch,
          node: process.version,
          developPresent: develop,
          worktreeConfigEnabled:
            worktreeConfig.status === 0 && worktreeConfig.stdout.trim() === 'true',
          worktreeHooksPath: hooksPath.status === 0 ? hooksPath.stdout.trim() : null,
          hookInstallation: 'not changed by doctor',
        },
        null,
        2
      )
    );
    if (!develop) process.exitCode = 2;
    return;
  }
  console.error(
    'usage: npm run harness -- <doctor|check --staged|pre-push|range <base-sha> <head-sha>|task-range <head-branch> <base-sha> <head-sha>|pr-policy <head-branch> <base-branch>|merge-back-check <release-or-hotfix-branch>|start <task-id> --slug <slug> --path <worktree-path>|start-hotfix <task-id> --slug <slug> --production-sha <sha> --path <worktree-path>|resume <task-id>|lease <inspect|hold> <task-id>|verify <task-id>|ready <task-id>|handoff <task-id>|ci-context <event.json> <output.json>|job-receipt <output.json>|release-check <manifest.json> --max-backup-age-hours <hours>|install-hooks|remove-hooks>'
  );
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`harness error: ${error.message}`);
  process.exitCode = 1;
});
