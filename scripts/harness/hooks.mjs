import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { access, appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, resolve } from 'node:path';
import { git, gitTry } from './git.mjs';
import { checkOutgoingRefs, checkStaged } from './check.mjs';
import { classifyBranch } from './branches.mjs';

const hookNames = ['pre-commit', 'commit-msg', 'post-commit', 'pre-push'];
const metadataName = 'harness-hooks.json';

function pathFromGit(root, ...args) {
  return resolve(root, git(['rev-parse', '--git-path', ...args], { cwd: root }).trim());
}

function hookConfig(root) {
  return gitTry(['config', '--show-origin', '--get', 'core.hooksPath'], { cwd: root });
}

function worktreeConfigEnabled(root) {
  const value = gitTry(['config', '--bool', '--get', 'extensions.worktreeConfig'], { cwd: root });
  return value.status === 0 && value.stdout.trim() === 'true';
}

export async function installHooks(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  if (!worktreeConfigEnabled(root))
    throw new Error(
      'extensions.worktreeConfig is disabled; no shared Git setting was changed. Review all worktrees before enabling it.'
    );
  const existingConfig = hookConfig(root);
  if (existingConfig.status === 0)
    throw new Error(
      `core.hooksPath is already configured (${existingConfig.stdout.trim()}); preserve or migrate it explicitly before install`
    );
  const gitDir = git(['rev-parse', '--git-dir'], { cwd: root }).trim();
  const installedDir = pathFromGit(root, 'harness-hooks');
  const metadataPath = pathFromGit(root, metadataName);
  const previousDir = pathFromGit(root, 'hooks');
  const currentMetadata = gitTry(['config', '--worktree', '--get', 'core.hooksPath'], {
    cwd: root,
  });
  if (currentMetadata.status === 0)
    throw new Error('worktree already has core.hooksPath configured');
  if ((await exists(installedDir)) || (await exists(metadataPath)))
    throw new Error('hook install files already exist; run doctor and resolve before retrying');

  const metadata = {
    schemaVersion: 1,
    worktree: root,
    gitDir: resolve(root, gitDir),
    installedPath: installedDir,
    previousPath: previousDir,
    hooks: {},
  };
  await mkdir(installedDir, { recursive: false });
  try {
    for (const name of hookNames) {
      const file = resolve(installedDir, name);
      const source = await readFile(resolve(root, '.githooks', name), 'utf8');
      if (!source.includes(`cli.mjs" hook ${name} "$@"`))
        throw new Error(`tracked wrapper for ${name} does not dispatch to the harness`);
      metadata.hooks[name] = createHash('sha256').update(source).digest('hex');
      await writeFile(file, source, { mode: 0o755, flag: 'wx' });
    }
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    git(['config', '--worktree', 'core.hooksPath', installedDir], { cwd: root });
  } catch (error) {
    await rm(installedDir, { recursive: true, force: true });
    await rm(metadataPath, { force: true });
    throw error;
  }
  return metadata;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function removeHooks(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  if (!worktreeConfigEnabled(root))
    throw new Error(
      'worktree configuration is disabled; refusing to guess or change hook settings'
    );
  const metadataPath = pathFromGit(root, metadataName);
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  if (metadata.worktree !== root) throw new Error('hook metadata belongs to a different worktree');
  const configured = gitTry(['config', '--worktree', '--get', 'core.hooksPath'], { cwd: root });
  if (
    configured.status !== 0 ||
    resolve(root, configured.stdout.trim()) !== resolve(metadata.installedPath)
  )
    throw new Error(
      'core.hooksPath changed after installation; refusing to overwrite the current setting'
    );
  for (const [name, expectedHash] of Object.entries(metadata.hooks)) {
    const actual = await readFile(resolve(metadata.installedPath, name), 'utf8');
    if (createHash('sha256').update(actual).digest('hex') !== expectedHash)
      throw new Error(`installed hook ${name} was edited; preserve it before removal`);
  }
  git(['config', '--worktree', '--unset', 'core.hooksPath'], { cwd: root });
  await rm(metadata.installedPath, { recursive: true });
  await rm(metadataPath);
  return { root, restoredPath: metadata.previousPath };
}

async function runOriginalHook(metadata, name, args, input) {
  const original = resolve(metadata.previousPath, name);
  try {
    await access(original, constants.X_OK);
  } catch {
    return { status: 0, ran: false };
  }
  if (original === process.argv[1])
    throw new Error(`hook dispatcher recursion detected for ${name}`);
  const result = spawnSync(original, args, {
    cwd: metadata.worktree,
    input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { status: result.status ?? 1, ran: true };
}

function validateCommitMessage(messagePath, root) {
  const message = readFileSync(resolve(root, messagePath), 'utf8');
  const merge = gitTry(['rev-parse', '--quiet', '--verify', 'MERGE_HEAD'], { cwd: root });
  if (merge.status === 0 && /^Merge /.test(message)) return;
  const policy = JSON.parse(readFileSync(resolve(root, '.harness/policy.json')));
  const typePattern = policy.commitMessage.conventionalTypes.join('|');
  if (
    !new RegExp(`^(?:${typePattern})(?:\\([a-z0-9._/-]+\\))?: .+`).test(
      message.split(/\r?\n/, 1)[0] ?? ''
    )
  )
    throw new Error('commit subject must use a configured Conventional Commit type');
  const taskId = /^Task-Id:\s*([A-Z]+-\d+)\s*$/m.exec(message)?.[1];
  const changeId = /^Change-Id:\s*([0-9a-f-]{36})\s*$/im.exec(message)?.[1];
  if (!taskId || !changeId)
    throw new Error('commit message requires Task-Id and Change-Id trailers');
  const branch = classifyBranch(gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim());
  if (branch.taskId && branch.taskId !== taskId)
    throw new Error(`commit Task-Id ${taskId} does not match branch task ${branch.taskId}`);
  const manifestPath = resolve(root, policy.taskManifestDirectory, `${taskId}.json`);
  const manifest = JSON.parse(readFileSync(manifestPath));
  if (manifest.taskId !== taskId || !['active', 'in-progress'].includes(manifest.state))
    throw new Error(`task ${taskId} is missing, mismatched, or inactive`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(changeId))
    throw new Error('Change-Id must be a UUIDv4');
  if (
    !Array.isArray(manifest.changeIds) ||
    !manifest.changeIds.some((id) => id.toLowerCase() === changeId.toLowerCase())
  )
    throw new Error(`Change-Id ${changeId} is not registered in task ${taskId}`);
}

export async function dispatchHook(name, args, input, cwd = process.cwd()) {
  if (!hookNames.includes(name)) throw new Error(`unsupported hook: ${basename(name)}`);
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  const metadataPath = pathFromGit(root, metadataName);
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  if (metadata.worktree !== root)
    throw new Error('hook installation does not match the active worktree');
  let original;
  try {
    original = await runOriginalHook(metadata, name, args, input);
  } catch (error) {
    if (name !== 'post-commit') throw error;
    process.stderr.write(`[harness] post-commit original hook failed: ${error.message}\n`);
    original = { status: 1, ran: true };
  }
  if (name === 'post-commit') {
    if (original.status !== 0)
      process.stderr.write(
        `[harness] original post-commit hook exited ${original.status}; the commit remains successful\n`
      );
    try {
      const commitSha = git(['rev-parse', 'HEAD'], { cwd: root }).trim();
      const message = git(['show', '-s', '--format=%B', 'HEAD'], { cwd: root });
      const record = {
        schemaVersion: 1,
        commitSha,
        branch: gitTry(['branch', '--show-current'], { cwd: root }).stdout.trim() || null,
        taskId: /^Task-Id:\s*([A-Z]+-\d+)\s*$/m.exec(message)?.[1] ?? null,
        changeId: /^Change-Id:\s*([0-9a-f-]{36})\s*$/im.exec(message)?.[1] ?? null,
        recordedAt: new Date().toISOString(),
      };
      await appendFile(
        pathFromGit(root, 'harness-post-commit.jsonl'),
        `${JSON.stringify(record)}\n`,
        {
          mode: 0o600,
          flag: 'a',
        }
      );
    } catch (error) {
      process.stderr.write(
        `[harness] commit was created, but its local post-commit record failed: ${error.message}\n`
      );
    }
    return { originalHookRan: original.ran, hook: name, commitOutcome: 'unchanged' };
  }
  if (original.status !== 0) process.exitCode = original.status;
  else if (name === 'pre-commit') await checkStaged(root);
  else if (name === 'commit-msg') validateCommitMessage(args[0], root);
  else if (name === 'pre-push') checkOutgoingRefs(input ?? '', root);
  return { originalHookRan: original.ran, hook: name };
}

export function installedHookDirectory(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd }).trim();
  return pathFromGit(root, 'harness-hooks');
}
