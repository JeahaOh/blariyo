import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const commonGitDir = resolve(
  root,
  execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()
);
const target = resolve(commonGitDir, 'quality-tools');
const platform = process.platform;
const arch = process.arch;
const targetKey = `${platform}-${arch}`;
const assets = {
  'darwin-arm64': {
    actionlint: [
      'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_darwin_arm64.tar.gz',
      'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f',
    ],
    shellcheck: [
      'https://github.com/koalaman/shellcheck/releases/download/v0.11.0/shellcheck-v0.11.0.darwin.aarch64.tar.gz',
      '339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f',
    ],
  },
  'linux-x64': {
    actionlint: [
      'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz',
      '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
    ],
    shellcheck: [
      'https://github.com/koalaman/shellcheck/releases/download/v0.11.0/shellcheck-v0.11.0.linux.x86_64.tar.gz',
      'b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6',
    ],
  },
};

if (!assets[targetKey]) throw new Error(`No pinned quality tool assets for ${targetKey}`);

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolveRun() : reject(new Error(`${command} failed (${code})`))
    );
  });
}

await mkdir(target, { recursive: true });
for (const [name, [url, expectedHash]] of Object.entries(assets[targetKey])) {
  const executable = resolve(target, name);
  try {
    const output = await new Promise((resolveRun, reject) => {
      const child = spawn(executable, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.once('error', reject);
      child.once('exit', (code) =>
        code === 0 ? resolveRun(stdout) : reject(new Error(`${name} missing`))
      );
    });
    if (output.includes(name === 'actionlint' ? '1.7.12' : '0.11.0')) continue;
  } catch {
    // Download and verify the pinned executable below.
  }

  const archive = resolve(target, `${name}.tar.gz`);
  await run('curl', ['--fail', '--location', '--silent', '--show-error', url, '--output', archive]);
  const digest = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  if (digest !== expectedHash) throw new Error(`${name} archive SHA-256 mismatch: ${digest}`);
  const extract = resolve(target, `${name}-extract`);
  await rm(extract, { recursive: true, force: true });
  await mkdir(extract, { recursive: true });
  await run('tar', ['-xzf', archive, '-C', extract]);
  const { readdir } = await import('node:fs/promises');
  async function findBinary(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        const found = await findBinary(path);
        if (found) return found;
      } else if (entry.name === name) return path;
    }
    return null;
  }
  const binary = await findBinary(extract);
  if (!binary) throw new Error(`${name} binary missing from pinned archive`);
  await writeFile(executable, await readFile(binary));
  await chmod(executable, 0o755);
  await rm(extract, { recursive: true, force: true });
  await rm(archive, { force: true });
  console.log(`${name}: installed pinned release after SHA-256 verification`);
}
