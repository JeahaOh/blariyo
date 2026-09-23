import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('environment examples keep Core reachable and public/collect storage separate', async () => {
  for (const name of ['local', 'dev', 'stage', 'prod']) {
    const text = await readFile(new URL(`../../.env.${name}.example`, import.meta.url), 'utf8');
    const env = Object.fromEntries(text.split('\n').filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map(line => {const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1)];}));
    const core = new URL(env.NUXT_CORE_ORIGIN);
    assert.equal(core.port, env.PORT, name);
    assert.notEqual(core.origin, new URL(env.SITE_ORIGIN).origin, name);
    assert.equal(env.HOST, name === 'local' ? '127.0.0.1' : '0.0.0.0', name);
    assert.equal(core.hostname, name === 'local' ? '127.0.0.1' : 'api', name);
    assert.equal(env.SERVICE_TOKEN, env.NUXT_SERVICE_TOKEN, name);
    assert.equal(env.IMAGE_ORIGIN, env.NUXT_PUBLIC_IMAGE_ORIGIN, name);
    assert.equal(env.COLLECT_BATCH_REVIEW_ENABLED, 'false', name);
    assert.equal(env.NUXT_COLLECT_BATCH_REVIEW_ENABLED, 'false', name);
    if (name !== 'local') {
      assert.equal(new Set([env.R2_PRIVATE_BUCKET, env.R2_PUBLIC_BUCKET, env.COLLECTOR_OBJECT_STORE_S3_BUCKET]).size, 3, name);
      assert.equal(env.COLLECT_READER_S3_BUCKET, env.COLLECTOR_OBJECT_STORE_S3_BUCKET, name);
      assert.notEqual(env.COLLECT_READER_S3_ACCESS_KEY_ID, env.COLLECTOR_OBJECT_STORE_S3_ACCESS_KEY_ID, name);
    }
  }
});
