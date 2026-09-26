// Capture actual public HTML without DB/S3 writes. Two independent sources at a time.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
const sources = JSON.parse(
  await readFile('apps/collector/ops/reference-sites.sources.example.json', 'utf8')
);
const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(sources);
if (names.some((n) => !Object.hasOwn(sources, n))) throw Error('UNKNOWN_SOURCE');
const executable = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
const reports = [];
let offset = 0,
  persist = Promise.resolve();
await mkdir('.local-data/site-probes', { recursive: true, mode: 0o700 });
async function worker() {
  while (offset < names.length) {
    const source = names[offset++];
    const args = [
      '-Dloader.main=com.blariyo.collector.run.SiteProbeMain',
      '-cp',
      resolve('apps/collector/build/libs/blariyo-collector-0.1.0.jar'),
      'org.springframework.boot.loader.launch.PropertiesLauncher',
      source,
      'list',
    ];
    let output = '';
    const child = spawn(executable, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (b) => {
      output += b;
    });
    child.stderr.on('data', () => {});
    const exit = await new Promise((r, j) => {
      child.once('error', j);
      child.once('exit', r);
    });
    const line = output.split('\n').findLast((l) => l.startsWith('{'));
    const result = line ? JSON.parse(line) : { source, state: 'FAILED', code: 'NO_PROBE_REPORT' };
    reports.push({ ...result, exit });
    console.log(
      JSON.stringify({
        source,
        state: result.state,
        entries: result.entries?.length,
        code: result.code,
      })
    );
    persist = persist.then(() =>
      writeFile('.local-data/site-probes/latest.json', JSON.stringify(reports, null, 2), {
        mode: 0o600,
      })
    );
    await persist;
  }
}
await Promise.all([worker(), worker()]);
