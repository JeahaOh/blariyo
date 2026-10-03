import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { directIdentity, directIdentityHash } from '../apps/api/dist/features/collection/direct-url.js';

const file = resolve('packages/contracts/fixtures/direct-identity.json');
const vectors = JSON.parse(await readFile(file, 'utf8')), cp = (await readFile('apps/collector/build/fixture-classpath.txt', 'utf8')).trim();
assert(process.env.JAVA_HOME, 'Explicit Java25 home required');
const executed = await promisify(execFile)(resolve(process.env.JAVA_HOME, 'bin/java'), ['-cp', cp, 'com.blariyo.collector.source.DirectIdentityFixtureMain', file]);
const java = JSON.parse(executed.stdout);
assert.equal(java.length, vectors.length);
for (const [index, vector] of vectors.entries()) {
  const expected = vector.error ? { error: true } : { canonicalUrl: vector.canonicalUrl, postKey: vector.postKey, normalizationVersion: 1 };
  let api;
  try { api = directIdentity(vector.url, vector.parser); } catch { api = { error: true }; }
  assert.deepEqual(api, expected, 'API vector ' + index); assert.deepEqual(java[index], expected, 'Java vector ' + index);
}
assert.notEqual(directIdentityHash('v1', 'a', 'bc').toString('hex'), directIdentityHash('v1', 'ab', 'c').toString('hex'));
assert.notEqual(directIdentityHash('v1', '한글', '1').toString('hex'), directIdentityHash('v1', '한', '글1').toString('hex'));
console.log(JSON.stringify({ state: 'PASSED', vectors: vectors.length, parsers: new Set(vectors.map(v => v.parser)).size, externalRequests: 0 }));
