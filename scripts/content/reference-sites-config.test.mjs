import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('21 reference sources distinguish blocked state from verified parsers', async () => {
  const config = JSON.parse(
    await readFile(
      new URL('../../apps/collector/ops/reference-sites.sources.example.json', import.meta.url)
    )
  );
  const expected = [
    'arcalive',
    'bobaedream',
    'clien',
    'dcinside',
    'dmitory',
    'dogdrip',
    'etoland',
    'fmkorea',
    'goodgag',
    'humoruniv',
    'instiz',
    'inven',
    'mlbpark',
    'natepann',
    'pgr21',
    'ppomppu',
    'ruliweb',
    'theqoo',
    'todayhumor',
    'yuldo',
    'youtube-community',
  ];
  assert.deepEqual(Object.keys(config).sort(), expected.sort());
  for (const [site, source] of Object.entries(config)) {
    assert.notEqual(source.parser, 'METADATA', site);
    assert.equal(typeof source.batchApproved, 'boolean');
    assert.match(source.blockedReason, /^([A-Z_]+)?$/);
    // Per-site evidence is separate from operational approval; registration is never verification.
    assert.equal(source.verification.discordGateway, false);
    assert.match(source.host, /^[a-z0-9.-]+$/i, site);
    if (source.parser !== 'BLOCKED') {
      assert.match(source.titleSelector, /title/);
      assert.match(source.imageSelector, /img/);
    } else {
      assert.equal(source.bodySelector, null);
    }
    assert.equal(typeof source.approved, 'boolean');
    assert.ok(
      ['HOT_LIST', 'GENERAL_LIST', 'DETAIL_ONLY', 'BLOCKED', 'UNVERIFIED'].includes(
        source.collectionPolicy
      ),
      site
    );
    if (source.collectionPolicy === 'HOT_LIST') assert.ok(source.charts.hot, site);
    if (source.collectionPolicy === 'GENERAL_LIST') {
      assert.ok(source.charts.latest, site);
      assert.equal(source.charts.hot, undefined, site);
      assert.equal(source.defaultChart, 'latest', site);
    }
    if (source.defaultChart !== null) assert.ok(source.charts[source.defaultChart], site);
    if (source.collectionPolicy === 'DETAIL_ONLY')
      assert.equal(Object.keys(source.charts).length, 0, site);
    assert.ok(['INCLUDE_UNKNOWN', 'REQUIRE_KNOWN'].includes(source.datePolicy));
  }
});

test('source configuration conforms to its schema', async () => {
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const ajv = new Ajv2020({ strict: false });
  const schema = JSON.parse(
    await readFile(new URL('../../apps/collector/ops/sources.schema.json', import.meta.url))
  );
  const config = JSON.parse(
    await readFile(
      new URL('../../apps/collector/ops/reference-sites.sources.example.json', import.meta.url)
    )
  );
  const validate = ajv.compile(schema);
  assert.ok(validate(config), JSON.stringify(validate.errors));
  const invalid = structuredClone(config);
  invalid.arcalive.maxPages = 11;
  assert.equal(validate(invalid), false);
});

test('readback manifests use an available chart for each source policy', async () => {
  const root = new URL('../../apps/collector/ops/', import.meta.url);
  const sources = JSON.parse(await readFile(new URL('reference-sites.sources.example.json', root)));
  for (const name of [
    'production-readback-sample.json',
    'production-readback-17-fetched.json',
    'production-readback-4-failed.json',
  ]) {
    const entries = JSON.parse(await readFile(new URL(name, root)));
    for (const entry of entries) {
      const source = sources[entry.source];
      assert.ok(source, `${name}: unknown source ${entry.source}`);
      if (entry.kind === 'batch') {
        assert.ok(['HOT_LIST', 'GENERAL_LIST'].includes(source.collectionPolicy), entry.source);
        assert.ok(
          source.charts[entry.chart],
          `${name}: ${entry.source}/${entry.chart} is not configured`
        );
      } else {
        assert.equal(entry.kind, 'collect-url');
        assert.equal(new URL(entry.url).protocol, 'https:');
      }
    }
  }
});
