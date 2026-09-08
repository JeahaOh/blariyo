import test from 'node:test';
import assert from 'node:assert/strict';
import { coreSchemaReady } from '../apps/api/src/app.mjs';
import { cleanup } from '../apps/api/src/cleanup.mjs';
import { loadCollectorTokens } from '../apps/api/src/startup.mjs';

test('disabled collection does not read the collector token file', async () => {
  let reads = 0;
  const reader = async () => {
    reads += 1;
    throw new Error('token file must not be read');
  };
  assert.deepEqual(
    await loadCollectorTokens(
      { collectManualUrlEnabled: false, collectDiscordCommandEnabled: false },
      { COLLECTOR_TOKENS_FILE: '/missing/collector-tokens.json' },
      reader
    ),
    []
  );
  assert.equal(reads, 0);
});

test('enabled collection loads the configured collector token file', async () => {
  let requested;
  assert.deepEqual(
    await loadCollectorTokens(
      { collectManualUrlEnabled: true, collectDiscordCommandEnabled: false },
      { COLLECTOR_TOKENS_FILE: '/fixture/collector-tokens.json' },
      async (path, encoding) => {
        requested = { path, encoding };
        return '["fixture-token"]';
      }
    ),
    ['fixture-token']
  );
  assert.deepEqual(requested, {
    path: '/fixture/collector-tokens.json',
    encoding: 'utf8',
  });
});

test('Core-only readiness accepts V003 while enabled collection requires V004 access', async () => {
  const calls = [];
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('ops.is_schema_ready')) return { rows: [{ ready: true }] };
      return { rows: [{ accessible: false }] };
    },
  };
  assert.equal(await coreSchemaReady(pool, false), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0], false);
  assert.equal(await coreSchemaReady(pool, true), false);
  assert.equal(calls.at(-1).sql.includes('has_schema_privilege'), true);
});

function cleanupFixture({ collectionExists, collectionCleanupFails = false, referenceFails = false }) {
  const deleted = [],
    calls = [];
  const query = async (sql) => {
    calls.push(sql);
    if (sql.includes("to_regclass('collect.candidate_image')"))
      return { rows: [{ relation: collectionExists ? 'collect.candidate_image' : null }] };
    if (sql.includes('SELECT id FROM collect.candidate')) {
      if (collectionCleanupFails) throw new Error('collection fixture failure');
      return { rows: [] };
    }
    if (sql.includes('SELECT 1 FROM collect.candidate_image')) {
      if (referenceFails) throw new Error('reference fixture failure');
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT 1 FROM content.board_post_image')) return { rows: [], rowCount: 0 };
    throw new Error('Unexpected pool query: ' + sql);
  };
  const client = {
    query: async (sql) => {
      calls.push(sql);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('FROM content.board_post_image')) return { rows: [] };
      if (sql.includes('DELETE FROM ops.idempotency_request')) return { rows: [] };
      throw new Error('Unexpected transaction query: ' + sql);
    },
    release() {},
  };
  return {
    pool: { query, connect: async () => client },
    storage: {
      inventory: async (bucket) =>
        bucket === 'private'
          ? [
              { key: 'staging/core-orphan', createdAt: new Date(0) },
              { key: 'collect-preview/candidate-orphan', createdAt: new Date(0) },
            ]
          : [],
      delete: async (bucket, key) => deleted.push(`${bucket}:${key}`),
    },
    deleted,
    calls,
  };
}

test('collection cleanup failure preserves Core cleanup and collect preview objects', async (t) => {
  const original = console.error;
  console.error = () => {};
  t.after(() => (console.error = original));
  for (const [options, error] of [
    [{ collectionExists: false }, null],
    [{ collectionExists: true, collectionCleanupFails: true }, 'COLLECTION_CLEANUP_FAILED'],
    [{ collectionExists: true, referenceFails: true }, 'COLLECTION_REFERENCE_CHECK_FAILED'],
  ]) {
    const fixture = cleanupFixture(options);
    if (error) await assert.rejects(cleanup(fixture.pool, fixture.storage), new RegExp(error));
    else await cleanup(fixture.pool, fixture.storage);
    assert.deepEqual(fixture.deleted, ['private:staging/core-orphan']);
    assert.ok(fixture.calls.some((sql) => sql.includes('DELETE FROM ops.idempotency_request')));
  }
});
