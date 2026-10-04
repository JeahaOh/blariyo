import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, copyFile, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const files = ['pre-commit', 'pre-merge-commit', 'pre-push', 'guard.sh', 'check-contracts.mjs'];
const marker = 'blariyo-local-git-guards-v1\n';
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: sourceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const exists = async (file) => access(file).then(() => true, () => false);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function run() {
  const mode = process.argv[2];
  if (!['install', 'check'].includes(mode)) throw new Error('사용법: node scripts/git-hooks.mjs install|check');
  if (await realpath(git('rev-parse', '--show-toplevel')) !== await realpath(sourceRoot)) {
    throw new Error('현재 저장소의 scripts/git-hooks.mjs를 실행하세요.');
  }
  const common = path.resolve(sourceRoot, git('rev-parse', '--git-common-dir'));
  const target = path.join(common, 'blariyo-hooks');
  let configured = '';
  try { configured = git('config', '--get', 'core.hooksPath'); } catch (error) {
    if (error.status !== 1) throw error;
  }
  if (configured && path.resolve(sourceRoot, configured) !== target) {
    throw new Error('다른 core.hooksPath가 설정돼 있습니다. 기존 hook의 담당·통합 방법을 확인하세요. 자동 덮어쓰기는 하지 않습니다.');
  }
  if (await exists(target) && (!await exists(path.join(target, '.owner')) || await readFile(path.join(target, '.owner'), 'utf8') !== marker)) {
    throw new Error('설치 경로에 소유권이 확인되지 않은 파일이 있습니다. 자동 덮어쓰기는 하지 않습니다.');
  }
  if (mode === 'install') {
    if (!configured) {
      const defaults = path.join(common, 'hooks');
      for (const name of await readdir(defaults).catch((error) => { if (error.code === 'ENOENT') return []; throw error; })) {
        if (!name.endsWith('.sample') && await access(path.join(defaults, name), constants.X_OK).then(() => true, () => false)) {
          throw new Error(`기존 실행 hook(${name})이 있습니다. 통합 방법을 먼저 확인하세요.`);
        }
      }
    }
    // Validate every source before touching the installed snapshot.
    for (const name of files) await access(path.join(sourceRoot, '.githooks', name), constants.R_OK);
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, '.owner'), marker);
    for (const name of files) {
      const temporary = path.join(target, `${name}.new`);
      await copyFile(path.join(sourceRoot, '.githooks', name), temporary);
      await chmod(temporary, 0o755);
      await rename(temporary, path.join(target, name));
    }
    // An installed copy remains active when switching to older branches.
    git('config', '--local', 'core.hooksPath', target);
    configured = git('config', '--get', 'core.hooksPath');
  }
  if (configured !== target) throw new Error('hook이 설치되지 않았습니다. npm run hooks:install을 실행하세요.');
  for (const name of files) {
    const source = await readFile(path.join(sourceRoot, '.githooks', name));
    const installed = await readFile(path.join(target, name));
    await access(path.join(target, name), constants.X_OK);
    if (hash(source) !== hash(installed)) throw new Error(`설치본이 현재 source와 다릅니다(${name}). 변경을 검토한 뒤 hooks:install로 갱신하세요.`);
  }
  console.log(`Git hook ${mode === 'install' ? '설치 및 확인' : '설치 상태 확인'} 완료: ${target}`);
}

run().catch((error) => {
  console.error(`[git-hooks] ${error.message}`);
  process.exitCode = 1;
});
