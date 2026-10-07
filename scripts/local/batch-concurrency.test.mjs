import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, copyFile, readdir, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {DEFAULT_SOURCE_CONCURRENCY, sourceConcurrency, runSourcePool} from './batch-concurrency.mjs';

test('default and positive overrides reject invalid concurrency', () => {
  assert.equal(DEFAULT_SOURCE_CONCURRENCY, 3);
  assert.equal(sourceConcurrency('5'), 5);
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '2foo', ' 2', '9007199254740992']) {
    assert.throws(() => sourceConcurrency(value), /positive integer/);
  }
});

test('source pool fills a free slot without waiting for a slow peer and respects limit', async () => {
  const started = [];
  const releases = new Map();
  const pool = runSourcePool(['slow', 'fast', 'next', 'last', 'slow'], 2, source => {
    started.push(source);
    return new Promise(resolve => releases.set(source, resolve));
  });
  assert.deepEqual(started, ['slow', 'fast']);
  releases.get('fast')(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ['slow', 'fast', 'next']);
  releases.get('next')(2);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ['slow', 'fast', 'next', 'last']);
  releases.get('last')(0);
  releases.get('slow')(0);
  const results = await pool;
  assert.equal(results.length, 4);
  assert.equal(results.find(result => result.source === 'next').exitCode, 2);
});

test('serial mode, spawn failure and cancellation preserve remaining work boundaries', async () => {
  const controller = new AbortController();
  const started = [];
  const results = await runSourcePool(['fail', 'stop', 'never'], 1, async source => {
    started.push(source);
    if (source === 'fail') throw new Error('fake spawn failure');
    controller.abort();
    return 143;
  }, controller.signal);
  assert.deepEqual(started, ['fail', 'stop']);
  assert.deepEqual(results.map(result => result.exitCode), [1, 143]);
  assert.deepEqual(await runSourcePool([], 9, () => assert.fail('empty pool ran')), []);
  await assert.rejects(runSourcePool(['one'], 0, () => {}), /INVALID_SOURCE_CONCURRENCY/);
});

test('CLI rejects invalid settings before reading config or launching any source', () => {
  for (const [args, concurrency, expected] of [
    [['--write-db'], '0', /positive integer/],
    [[], '3', /BATCH_MODE_REQUIRED/],
    [['--write-db', '--dry-run'], '3', /BATCH_MODE_REQUIRED/],
    [['--write-db', '--source', 'x'], '3', /BATCH_OPTIONS_INVALID/],
    [['--write-db', '--max-items'], '3', /BATCH_OPTIONS_INVALID/],
  ]) {
    const result = spawnSync(process.execPath, [resolve('scripts/local/run-batches.mjs'), ...args], {
      encoding:'utf8', env:{...process.env, COLLECTOR_SOURCE_CONCURRENCY:concurrency, COLLECTOR_SOURCE_CONFIG:'/nonexistent/source.json'},
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
    assert.equal(result.stdout, '');
  }
});

test('CLI runs bounded child processes and preserves per-source failures and options', async () => {
  const root = await mkdtemp(join(tmpdir(), 'blariyo-source-pool-'));
  try {
    const scripts = join(root, 'scripts/local');
    await mkdir(scripts, {recursive:true});
    for (const name of ['run-batches.mjs', 'batch-concurrency.mjs']) await copyFile(resolve('scripts/local', name), join(scripts, name));
    const config = join(root, 'sources.json');
    await writeFile(config, JSON.stringify({first:{}, disabled:{approved:false,blockedReason:'SOURCE_DISABLED'}, second:{}, third:{}, fourth:{}}));
    await writeFile(join(scripts, 'run-batch.mjs'), `
      import assert from 'node:assert/strict';
      assert.deepEqual(process.argv.slice(2).filter((_,i)=>i!==2), ['batch','--source','--max-items','10','--write-db']);
      assert.equal(process.env.COLLECTOR_SOURCE_CONFIG, ${JSON.stringify(config)});
      const source=process.argv[4];
      setTimeout(()=>process.exit(source==='second'?2:0), 20);
    `);
    const child = spawn(process.execPath, [join(scripts, 'run-batches.mjs'), '--max-items', '10', '--write-db'], {
      cwd:root, env:{...process.env, COLLECTOR_SOURCE_CONFIG:config, COLLECTOR_SOURCE_CONCURRENCY:'2'}, stdio:['ignore','pipe','pipe'],
    });
    let output = '', errors = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { errors += chunk; });
    const code = await new Promise((resolve,reject) => { child.once('error',reject); child.once('close',resolve); });
    assert.equal(code, 1, errors);
    assert.equal(errors, '');
    const events = output.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(events[0].excludedSources, ['disabled']);
    assert.equal(events[0].sources, 4);
    assert.equal(events.some(event => event.source === 'disabled'), false);
    let active = 0, peak = 0;
    for (const event of events) {
      if (event.event === 'source-started') peak = Math.max(peak, ++active);
      if (event.event === 'source-finished') active--;
    }
    assert.equal(peak, 2);
    assert.equal(active, 0);
    assert.deepEqual(events.at(-1).results.map(result => result.source).sort(), ['first','fourth','second','third']);
    assert.equal(events.at(-1).results.find(result => result.source === 'second').exitCode, 2);
    const filtered = spawnSync(process.execPath, [join(scripts, 'run-batches.mjs'), '--max-items', '10', '--write-db'], {
      cwd:root, env:{...process.env, COLLECTOR_SOURCE_CONFIG:config, COLLECTOR_SOURCE_FILTER:'first,disabled'}, encoding:'utf8',
    });
    assert.equal(filtered.status, 0, filtered.stderr);
    const filteredEvents = filtered.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(filteredEvents.at(-1).results, [{source:'first', exitCode:0}]);
    const invalidFilter = spawnSync(process.execPath, [join(scripts, 'run-batches.mjs'), '--write-db'], {
      cwd:root, env:{...process.env, COLLECTOR_SOURCE_CONFIG:config, COLLECTOR_SOURCE_FILTER:'unknown'}, encoding:'utf8',
    });
    assert.equal(invalidFilter.status, 1);
    assert.match(invalidFilter.stderr, /SOURCE_FILTER_INVALID/);
    await writeFile(config, JSON.stringify({disabled:{approved:false,blockedReason:'SOURCE_DISABLED'}}));
    const empty = spawnSync(process.execPath, [join(scripts, 'run-batches.mjs'), '--write-db'], {
      cwd:root, env:{...process.env, COLLECTOR_SOURCE_CONFIG:config}, encoding:'utf8',
    });
    assert.equal(empty.status, 0, empty.stderr);
    const emptyEvents = empty.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(emptyEvents[0].sources, 0);
    assert.deepEqual(emptyEvents.at(-1).results, []);
    assert.equal(emptyEvents.some(event => event.event === 'source-started'), false);
  } finally { await rm(root, {recursive:true, force:true}); }
});

test('stopping the pool reaches the wrapped Java process and does not start queued sources', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'blariyo-source-stop-')));
  try {
    const scripts = join(root, 'scripts/local');
    const development = join(root, '.local-data/development');
    const javaBin = join(root, 'fake-jdk/bin');
    for (const directory of [scripts, development, javaBin, join(root, 'apps/collector/build/libs')]) await mkdir(directory, {recursive:true});
    for (const name of ['run-batches.mjs', 'batch-concurrency.mjs', 'run-batch.mjs']) await copyFile(resolve('scripts/local', name), join(scripts, name));
    await writeFile(join(root, 'apps/collector/build/libs/blariyo-collector-0.1.0.jar'), 'fake jar, never executed');
    await writeFile(join(development, 'batch-config.json'), JSON.stringify({version:1, batchRole:'blariyo_batch_local', batchPassword:'test-only', objectRoot:join(root, '.local-data/collector-objects')}));
    const config = join(root, 'sources.json');
    await writeFile(config, JSON.stringify({first:{}, never:{}}));
    await writeFile(join(javaBin, 'java'), `#!${process.execPath}
      process.on('SIGTERM',()=>{console.log('JAVA_STOPPED');process.exit(143);});
      console.log('JAVA_READY');
      setTimeout(()=>process.exit(98), 3000);
    `, {mode:0o700});
    const child = spawn(process.execPath, [join(scripts, 'run-batches.mjs'), '--write-db'], {
      cwd:root, env:{...process.env, JAVA_HOME:join(root,'fake-jdk'), COLLECTOR_SOURCE_CONFIG:config, COLLECTOR_SOURCE_CONCURRENCY:'1'}, stdio:['ignore','pipe','pipe'],
    });
    let output = '', errors = '', stopped = false;
    child.stdout.on('data', chunk => {
      output += chunk;
      if (!stopped && output.includes('JAVA_READY')) { stopped = true; child.kill('SIGTERM'); }
    });
    child.stderr.on('data', chunk => { errors += chunk; });
    const code = await new Promise((resolve,reject) => { child.once('error',reject); child.once('close',resolve); });
    assert.equal(code, 143, errors);
    assert.equal(errors, '');
    assert.match(output, /JAVA_STOPPED/);
    assert.doesNotMatch(output, /"source":"never"/);
    const summary = JSON.parse(output.trim().split('\n').at(-1));
    assert.equal(summary.interrupted, true);
    assert.deepEqual(summary.results, [{source:'first',exitCode:143}]);
    assert.deepEqual(await readdir(development), ['batch-config.json']);
  } finally { await rm(root, {recursive:true, force:true}); }
});
