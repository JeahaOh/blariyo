'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { generate, renderTemplate } = require('./prepare-policy-review.cjs');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blariyo-policy-test-'));
  try {
    const directory = path.join(root, 'config');
    fs.mkdirSync(directory, { mode: 0o700 });
    const input = path.join(directory, 'public-contact.json');
    const config = {
      operatorDisplayName: '검토 테스트 <script>alert(1)</script> & "이름"',
      contactEmail: 'contact@example.com',
      rightsEmail: 'rights@example.com',
      privacyEmail: 'privacy@example.com',
      privacyOfficer: '검토 담당자',
    };
    const original = JSON.stringify(config);
    fs.writeFileSync(input, original, { mode: 0o600 });
    const first = await generate(directory);
    const before = fs
      .readdirSync(first.destination)
      .map((name) => [name, fs.readFileSync(path.join(first.destination, name), 'utf8')]);
    assert.equal(before.length, 5);
    assert.equal(fs.statSync(first.destination).mode & 0o777, 0o700);
    for (const [name, content] of before) {
      assert.equal(fs.statSync(path.join(first.destination, name)).mode & 0o777, 0o600);
      assert(content.includes('공개 정책 편집본'));
      assert(content.includes("default-src 'none'"));
      assert(!content.includes('<script>'));
      assert(!content.includes('{{'));
      for (const match of content.matchAll(/href="([^"#]+)"/g)) {
        if (match[1].startsWith('https:')) continue;
        assert(fs.existsSync(path.join(first.destination, match[1])));
      }
    }
    assert(before.find(([name]) => name === 'terms.html')[1].includes('&lt;script&gt;'));
    const second = await generate(directory);
    assert.notEqual(first.destination, second.destination);
    for (const [name, content] of before)
      assert.equal(fs.readFileSync(path.join(first.destination, name), 'utf8'), content);
    assert.equal(fs.readFileSync(input, 'utf8'), original);
    assert.throws(() => renderTemplate('{{unknown}}', config), /UNKNOWN_TEMPLATE_FIELD/);
    assert.throws(() => renderTemplate('{{broken', config), /INVALID_TEMPLATE/);
    // Final policies parse; unresolved placeholders remain forbidden.
    const parser = await import(
      pathToFileURL(
        path.resolve(__dirname, '../../apps/api/dist/features/policies/policy-artifact.js')
      )
    );
    for (const type of ['terms', 'privacy']) {
      const artifact = {
        type,
        version: 'v0.1',
        title: type,
        body: fs.readFileSync(path.join(first.destination, type + '.html'), 'utf8'),
        effectiveAt: new Date().toISOString(),
      };
      artifact.checksum = parser.artifactChecksum(artifact);
      assert.equal(
        parser.policyArtifact(artifact, { production: true, legalConfig: config }).version,
        'v0.1'
      );
      const unresolved = { ...artifact, body: artifact.body + '<p>[출시 차단: 미확정]</p>' };
      unresolved.checksum = parser.artifactChecksum(unresolved);
      assert.throws(() =>
        parser.policyArtifact(unresolved, { production: true, legalConfig: config })
      );
    }
    const entries = fs.readdirSync(directory).length;
    fs.chmodSync(input, 0o644);
    await assert.rejects(generate(directory));
    assert.equal(fs.readdirSync(directory).length, entries);
    assert.equal(fs.statSync(input).mode & 0o777, 0o644);
    fs.chmodSync(input, 0o600);
    fs.renameSync(input, path.join(directory, 'original.json'));
    fs.symlinkSync(path.join(directory, 'original.json'), input);
    await assert.rejects(generate(directory));
    assert.equal(fs.readFileSync(path.join(directory, 'original.json'), 'utf8'), original);
    console.log(
      'PASS 검토본 생성·권한·연락처 이스케이프·기존 파일 보존·링크·부적절 권한/symlink 거부·실제 앱의 확정 본문 파싱'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(() => {
  console.error('FAIL 정책 검토본 격리 검사');
  process.exitCode = 1;
});
