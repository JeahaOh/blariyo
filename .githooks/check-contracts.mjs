// Read only Git's index: unstaged repairs must never make a broken commit pass.
// Installed beside the hooks so older branches do not remove this guard.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const git = (...args) => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const baselinePath = 'docs/migration/contract-baseline.json';
const evolutionPath = 'docs/migration/contract-evolution.json';
const record = (value) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'invalid contract manifest object');
  return value;
};

function check() {
  const entries = new Map();
  for (const line of git('ls-files', '--stage', '-z').toString().split('\0').filter(Boolean)) {
    const match = /^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(line);
    assert.ok(match, 'invalid index entry');
    entries.set(match[4], { mode: match[1], stage: match[3] });
  }
  if (!entries.has(baselinePath) && !entries.has(evolutionPath)) {
    // A branch predating contract tracking remains usable; deleting an existing
    // manifest from a modern branch must not turn off validation.
    for (const file of [baselinePath, evolutionPath]) {
      let existed = false;
      try { git('cat-file', '-e', `HEAD:${file}`); existed = true; } catch { /* no prior manifest */ }
      assert.ok(!existed, `contract manifest deleted from index: ${file}`);
    }
    return;
  }
  const read = (file) => {
    const entry = entries.get(file);
    assert.ok(entry && entry.stage === '0' && /^100(644|755)$/.test(entry.mode), `missing, conflicted or non-regular staged file: ${file}`);
    return git('show', `:${file}`);
  };
  const baseline = record(JSON.parse(read(baselinePath).toString()));
  const hashes = record(baseline.files);
  const evolution = record(JSON.parse(read(evolutionPath).toString()));
  const current = { ...hashes };
  assert.ok(Object.keys(hashes).length >= 16, 'incomplete contract baseline');
  for (const [file, value] of Object.entries(record(evolution.amendedContracts))) {
    const change = record(value);
    assert.ok(file.startsWith('packages/contracts/') && !file.endsWith('.sql'), `invalid amended contract: ${file}`);
    assert.equal(change.baselineSha256, hashes[file], `baseline mismatch: ${file}`);
    assert.ok(typeof change.reason === 'string' && change.reason.length > 20, `missing change reason: ${file}`);
    current[file] = change.sha256;
  }
  for (const [file, hash] of Object.entries(record(evolution.addedMigrations))) {
    assert.ok(!Object.hasOwn(hashes, file), `existing migration amended: ${file}`);
    assert.match(file, /^(apps\/api\/migrations\/V\d+__[^/]+|apps\/collector\/src\/main\/resources\/db\/collector-v\d+)\.sql$/);
    current[file] = hash;
  }
  const mismatches = [];
  for (const [file, expected] of Object.entries(current)) {
    assert.match(expected, /^[a-f0-9]{64}$/, `invalid SHA-256: ${file}`);
    if (createHash('sha256').update(read(file)).digest('hex') !== expected) mismatches.push(file);
  }
  assert.equal(mismatches.length, 0, `contract SHA-256 mismatch:\n${mismatches.join('\n')}\n변경 계약의 명세·생성 파일과 contract-evolution.json의 해시·사유를 검토하고 함께 stage하세요. 기존 SQL migration은 수정하지 마세요.`);
  for (const pattern of [/^apps\/api\/migrations\/[^/]+\.sql$/, /^apps\/collector\/src\/main\/resources\/db\/collector-v\d+\.sql$/]) {
    assert.deepEqual([...entries.keys()].filter(file => pattern.test(file)).sort(), Object.keys(current).filter(file => pattern.test(file)).sort(), 'migration inventory mismatch');
  }
  for (const name of ['m0-core', 'm0-collection-assist']) {
    const canonical = `docs/development-specs/${name}/openapi/${name}.yaml`;
    const packaged = `packages/contracts/openapi/${name}.yaml`;
    assert.ok(read(canonical).equals(read(packaged)), `canonical OpenAPI mismatch: ${packaged}`);
  }
  console.log('[git-guard] staged 계약·migration·OpenAPI 검사 통과');
}

try { check(); } catch (error) {
  console.error(`[git-guard] ${error.message}`);
  process.exitCode = 1;
}
