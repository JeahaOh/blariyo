import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('21 reference sources distinguish blocked state from verified parsers', async () => {
  const config = JSON.parse(await readFile(new URL('../../apps/collector/ops/reference-sites.sources.example.json', import.meta.url)));
  const expected = ['arcalive','bobaedream','clien','dcinside','dmitory','dogdrip','etoland','fmkorea','goodgag','humoruniv','instiz','inven','mlbpark','natepann','pgr21','ppomppu','ruliweb','theqoo','todayhumor','yuldo','youtube-community'];
  assert.deepEqual(Object.keys(config).sort(), expected.sort());
  for (const [site, source] of Object.entries(config)) {
    assert.notEqual(source.parser, 'METADATA', site);
    assert.equal(source.batchApproved, false);
    assert.match(source.blockedReason, /^[A-Z_]+$/);
    assert.equal(source.verification.liveDbReadback, false);
    assert.match(source.host, /^[a-z0-9.-]+$/i, site);
    if (source.parser !== 'BLOCKED') {
      assert.match(source.titleSelector, /title/);
      assert.match(source.imageSelector, /img/);
    } else {
      assert.equal(source.bodySelector, null);
    }
    assert.equal(source.approved, false);
    assert.ok(['HOT_LIST', 'DETAIL_ONLY', 'BLOCKED', 'UNVERIFIED'].includes(source.collectionPolicy), site);
    if (source.collectionPolicy === 'HOT_LIST') assert.ok(source.charts.hot, site);
    if (source.collectionPolicy !== 'HOT_LIST') assert.equal(source.batchApproved, false);
  }
});


test('source configuration conforms to its schema', async () => {
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const ajv = new Ajv2020({ strict: false });
  const schema = JSON.parse(await readFile(new URL('../../apps/collector/ops/sources.schema.json', import.meta.url)));
  const config = JSON.parse(await readFile(new URL('../../apps/collector/ops/reference-sites.sources.example.json', import.meta.url)));
  const validate = ajv.compile(schema);
  assert.ok(validate(config), JSON.stringify(validate.errors));
  const invalid = structuredClone(config); invalid.arcalive.maxPages = 11;
  assert.equal(validate(invalid), false);
});
