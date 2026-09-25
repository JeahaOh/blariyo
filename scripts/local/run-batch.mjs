// Cross-platform wrapper for this repository's fixed local development DB and object root.
import { readFile, mkdtemp, copyFile, chmod, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
const config = JSON.parse(await readFile('.local-data/development/batch-config.json', 'utf8'));
if (
  config.version !== 1 ||
  config.batchRole !== 'blariyo_batch_local' ||
  config.objectRoot !== resolve('.local-data/collector-objects')
)
  throw Error('LOCAL_CONFIG_MISMATCH');
const executable = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
// Spring loads nested JAR classes lazily. Rebuilding the source JAR during a long
// collection must not change the executable beneath the running process.
const directory = await mkdtemp(resolve('.local-data/development/batch-executable-'));
try {
  const executableJar = join(directory, 'collector.jar');
  await copyFile(resolve('apps/collector/build/libs/blariyo-collector-0.1.0.jar'), executableJar);
  await chmod(executableJar, 0o600);
  const child = spawn(
    executable,
    [
      '-Dloader.main=com.blariyo.collector.ops.BatchMain',
      '-cp',
      executableJar,
      'org.springframework.boot.loader.launch.PropertiesLauncher',
      ...process.argv.slice(2),
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        COLLECTOR_DB_URL: 'jdbc:postgresql://127.0.0.1:5439/blariyo_local',
        COLLECTOR_DB_USER: config.batchRole,
        COLLECTOR_DB_PASSWORD: config.batchPassword,
        COLLECTOR_OBJECT_STORE_DIRECTORY: config.objectRoot,
        COLLECTOR_SOURCES_FILE: resolve('apps/collector/ops/reference-sites.sources.example.json'),
      },
    }
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} catch {
  console.error('LOCAL_BATCH_START_FAILED');
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
