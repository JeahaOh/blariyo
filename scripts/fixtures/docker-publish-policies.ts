import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const artifacts: unknown = JSON.parse(readFileSync(0, 'utf8'));
assert.ok(Array.isArray(artifacts) && artifacts.length === 2);
assert.equal(process.getuid?.(), 0);
for (const [index, artifact] of artifacts.entries()) {
  const path = `/tmp/docker-policy-${index}.json`;
  writeFileSync(path, JSON.stringify(artifact), { mode: 0o600 });
  execFileSync(
    process.execPath,
    ['apps/api/dist/commands/command.js', 'policies:publish', '--artifact=' + path],
    { stdio: 'inherit' }
  );
}
