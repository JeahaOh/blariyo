import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const containerName = 'blariyo-local-playwright-server';
const host = '127.0.0.1';
const port = 55450;
const endpoint = `ws://${host}:${port}/`;
const require = createRequire(import.meta.url);
const playwrightVersion = require('@playwright/test/package.json').version;
const image = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;
const targets = process.argv.slice(2);
const testTargets = targets.length ? targets : ['tests/browser/*.test.ts'];

function fail(message) {
  throw new Error(message);
}

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function localDatabaseUrl() {
  const name = 'blariyo-m0-core-local-postgresql-1';
  let inspected;
  try {
    inspected = JSON.parse(docker(['inspect', name]))[0];
  } catch {
    fail(
      `실행 중인 PostgreSQL 컨테이너 ${name}을 찾을 수 없습니다. Docker Compose의 로컬 PostgreSQL을 먼저 실행하세요.`
    );
  }
  if (!inspected?.State?.Running) fail(`PostgreSQL 컨테이너 ${name}이 실행 중이 아닙니다.`);
  const published = inspected.NetworkSettings?.Ports?.['5432/tcp'] ?? [];
  if (!published.some((binding) => binding.HostIp === host && binding.HostPort === '5439')) {
    fail(
      `${name}의 PostgreSQL 포트가 ${host}:5439에 공개되어 있지 않습니다. 임의의 DB 포트로 접속하지 않습니다.`
    );
  }
  const env = Object.fromEntries(
    (inspected.Config?.Env ?? []).map((item) => {
      const separator = item.indexOf('=');
      return [item.slice(0, separator), item.slice(separator + 1)];
    })
  );
  const user = env.POSTGRES_USER;
  if (!user) fail(`${name}에 POSTGRES_USER 설정이 없어 격리 테스트 연결 URL을 만들 수 없습니다.`);

  let password = env.POSTGRES_PASSWORD;
  if (!password && env.POSTGRES_PASSWORD_FILE) {
    try {
      password = docker(['exec', name, 'cat', env.POSTGRES_PASSWORD_FILE]);
    } catch {
      fail(`${name}의 PostgreSQL password secret을 읽지 못했습니다.`);
    }
  }
  const auth = `${encodeURIComponent(user)}${password ? `:${encodeURIComponent(password)}` : ''}`;
  return `postgresql://${auth}@${host}:5439/postgres`;
}

function assertTestTargets() {
  for (const target of testTargets) {
    if (target.startsWith('-') || !target.startsWith('tests/') || !target.endsWith('.test.ts')) {
      fail(`테스트 대상은 tests/ 아래의 *.test.ts 경로여야 합니다: ${target}`);
    }
  }
}

function assertImageInstalled() {
  const result = spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' });
  if (result.status !== 0) {
    fail(
      `Playwright 이미지가 설치되지 않았습니다. 먼저 아래 명령으로 받으세요:\n  docker pull ${image}\n그 뒤 이 테스트 명령을 다시 실행하세요.`
    );
  }
}

function assertPortFree() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new Error(
          `${host}:${port} 포트를 사용할 수 없습니다. 기존 프로세스를 확인하고 다시 실행하세요.`
        )
      )
    );
    server.listen(port, host, () => server.close(resolve));
  });
}

async function waitForPort() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ready = await new Promise((resolve) => {
      const request = get(`http://${host}:${port}/`, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolve(response.statusCode === 200 && body === 'Running'));
      });
      request.setTimeout(1000, () => request.destroy());
      request.once('error', () => resolve(false));
    });
    if (ready) return;
    await delay(250);
  }
  fail('Docker Playwright 서버가 30초 안에 준비되지 않았습니다.');
}

let ownedContainerId;
try {
  assertTestTargets();
  // A fixed name makes concurrent runs and stale containers fail closed.
  try {
    docker(['inspect', containerName]);
    fail(
      `컨테이너 이름 ${containerName}이 이미 사용 중입니다. 기존 컨테이너를 건드리지 않고 중단합니다.`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('이미 사용 중입니다')) throw error;
  }
  await assertPortFree();
  assertImageInstalled();
  const databaseUrl = localDatabaseUrl();
  ownedContainerId = docker([
    'run',
    '-d',
    '--rm',
    '--name',
    containerName,
    '-p',
    `${host}:${port}:55450`,
    image,
    'npx',
    'playwright',
    'run-server',
    '--host',
    '0.0.0.0',
    '--port',
    String(port),
  ]);
  await waitForPort();
  const testProcess = spawn(process.execPath, ['--test', '--test-concurrency=1', ...testTargets], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_DATABASE_ADMIN_URL: databaseUrl,
      PLAYWRIGHT_WS_ENDPOINT: endpoint,
    },
  });
  const exitCode = await new Promise((resolve, reject) => {
    const stop = (signal) => testProcess.kill(signal);
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    testProcess.once('error', reject);
    testProcess.once('exit', (code, signal) => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      if (signal) reject(new Error(`브라우저 테스트가 ${signal} 신호로 종료됐습니다.`));
      else resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : '로컬 Playwright 실행에 실패했습니다.');
  process.exitCode = 1;
} finally {
  if (ownedContainerId) {
    try {
      // Remove only the container created by this invocation, by immutable ID.
      docker(['rm', '-f', ownedContainerId]);
    } catch {
      console.error(
        '이번 실행에서 만든 Playwright 컨테이너를 자동 종료하지 못했습니다. Docker 상태를 확인하세요.'
      );
      process.exitCode = 1;
    }
  }
}
