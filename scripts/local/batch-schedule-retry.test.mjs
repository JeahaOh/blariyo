import test from 'node:test';
import assert from 'node:assert/strict';
import {batchReports, retrySources, collectWithRecovery} from './batch-schedule-retry.mjs';

const report = (source, state, errors = []) => ({source, state, errors});
function fixture(overrides = {}) {
  let time = 0;
  const events = [], calls = [];
  const controller = new AbortController();
  const options = {signal:controller.signal, deadline:1000, now:() => time,
    ready:async () => true, wait:async ms => {time += ms;}, publish:async value => events.push(value),
    retryDelays:[5, 15], readinessPoll:10,
    run:async sources => {calls.push(sources); return {exitCode:0, reports:[report('ok', 'COMPLETED')]};}, ...overrides};
  return {options, events, calls, controller};
}

test('parses report lines and retries only transient failures', () => {
  const reports = [report('dns', 'FAILED', ['SOURCE_DNS_FAILED']), report('ok', 'COMPLETED'),
    report('blocked', 'BLOCKED', ['CHART_UNVERIFIED']), report('parse', 'FAILED', ['SOURCE_PARSE_FAILED']),
    report('mixed', 'PARTIAL', ['SOURCE_DNS_FAILED', 'SOURCE_NOT_ALLOWED'])];
  const parsed = batchReports('java diagnostic\n' + reports.map(report => JSON.stringify({report})).join('\n'));
  assert.deepEqual(parsed, reports);
  assert.deepEqual(retrySources(parsed), ['dns']);
});

test('waits for readiness, retries failed source only, retains blocked result honestly', async () => {
  let checks = 0;
  const calls = [];
  const f = fixture({ready:async () => ++checks > 2, run:async sources => {
    calls.push(sources);
    return sources ? {exitCode:0, reports:[report('dns', 'COMPLETED')]} :
      {exitCode:1, reports:[report('dns', 'FAILED', ['SOURCE_DNS_FAILED']), report('ok', 'COMPLETED'), report('blocked', 'BLOCKED', ['CHART_UNVERIFIED'])]};
  }});
  const result = await collectWithRecovery(f.options);
  assert.deepEqual(calls, [undefined, ['dns']]);
  assert.equal(result.state, 'COMPLETED_WITH_ERRORS');
  assert.equal(result.exitCode, 1);
  assert.equal(f.events.filter(event => event.state === 'WAITING_FOR_NETWORK_OR_DB').length, 2);
});

test('limits transient retries to three attempts', async () => {
  const f = fixture({run:async () => ({exitCode:1, reports:[report('dns', 'FAILED', ['SOURCE_DNS_FAILED'])]})});
  const result = await collectWithRecovery(f.options);
  assert.equal(result.attempts.length, 3);
  assert.equal(result.exitCode, 1);
});

test('no network reaches deadline without starting collection', async () => {
  const f = fixture({ready:async () => false, deadline:25});
  const result = await collectWithRecovery(f.options);
  assert.equal(result.state, 'TIMED_OUT');
  assert.equal(f.calls.length, 0);
});

test('stop during retry wait prevents new collection', async () => {
  const f = fixture({run:async () => ({exitCode:1, reports:[report('dns', 'FAILED', ['SOURCE_DNS_FAILED'])]})});
  f.options.wait = async () => {f.controller.abort(); throw new Error('aborted');};
  const result = await collectWithRecovery(f.options);
  assert.equal(result.state, 'CANCELLED');
  assert.equal(result.attempts.length, 1);
});

test('empty report output never becomes success', async () => {
  const f = fixture({run:async () => ({exitCode:0, reports:[]})});
  assert.equal((await collectWithRecovery(f.options)).state, 'COMPLETED_WITH_ERRORS');
});
