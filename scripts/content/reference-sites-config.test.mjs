import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all reference sources have a parser/config fixture', async () => {
  const config = JSON.parse(await readFile(new URL('../../apps/collector/ops/reference-sites.sources.example.json', import.meta.url)));
  const expected = ['arcalive','bobaedream','clien','dcinside','dmitory','dogdrip','etoland','fmkorea','goodgag','humoruniv','instiz','inven','mlbpark','natepann','pgr21','ppomppu','ruliweb','theqoo','todayhumor','yuldo','youtube-community'];
  assert.deepEqual(Object.keys(config).sort(), expected.sort());
  for (const [site, source] of Object.entries(config)) {
    assert.equal(source.parser, 'METADATA', site);
    assert.match(source.host, /^[a-z0-9.-]+$/i, site);
    assert.match(source.titleSelector, /title/);
    assert.match(source.imageSelector, /img/);
    assert.equal(source.approved, false);
  }
});
