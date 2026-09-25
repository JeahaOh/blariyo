import { spawnSync } from 'node:child_process';

export function git(args, { cwd, input, encoding = 'utf8' } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    input,
    encoding,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    throw new Error(`git ${args[0]} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

export function gitTry(args, options) {
  const result = spawnSync('git', args, {
    cwd: options?.cwd,
    input: options?.input,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
