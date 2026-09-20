// Existing approved policy templates -> persistent local development DB only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import contacts from '../../deploy/application/prepare-public-config.cjs';
import renderer from '../../deploy/application/prepare-policy-review.cjs';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { PoliciesService } from '../../apps/api/dist/features/policies/policies.service.js';
import {
  artifactChecksum,
  policyArtifact,
} from '../../apps/api/dist/features/policies/policy-artifact.js';

const databaseUrl = 'postgresql://blariyo_local@127.0.0.1:55439/blariyo_local';
async function main() {
  assert.equal(process.argv.slice(2).join(' '), '--apply', 'Use --apply');
  const { config } = contacts.prepare();
  await contacts.validate(config);
  const policies = await Promise.all(
    ['terms', 'privacy'].map(async (type) => {
      const body = renderer.renderTemplate(
        await readFile(new URL(`../../docs/legal/m0-core/${type}.html`, import.meta.url), 'utf8'),
        config
      );
      assert.ok(!/\[출시 차단|\[입력 필요|{{/.test(body), 'Unresolved policy');
      const input = {
        type,
        version: 'v0.1',
        title: type === 'terms' ? '이용약관' : '개인정보처리방침',
        body,
        effectiveAt: new Date().toISOString(),
      };
      return { ...input, checksum: artifactChecksum(input) };
    })
  );
  const db = await createDataSource(databaseUrl).initialize();
  let app;
  try {
    const options = { production: true, legalConfig: config, siteOrigin: 'http://localhost:3000' };
    const planned = [];
    // Check both existing versions before changing either. Never overwrite a published version.
    for (const input of policies) {
      const expected = policyArtifact(input, options);
      const rows = await db.query(
        'SELECT title,body_html,status FROM legal.policy_version WHERE policy_type=$1 AND version_label=$2',
        [input.type.toUpperCase(), input.version]
      );
      if (rows.length) {
        assert.equal(rows[0].title, expected.title, 'Existing policy conflict');
        assert.equal(rows[0].body_html, expected.bodyHtml, 'Existing policy conflict');
        assert.equal(rows[0].status, 'EFFECTIVE', 'Existing policy status conflict');
      } else planned.push(input);
    }
    app = await createNestApplication({
      databaseUrl,
      serviceToken: randomBytes(32).toString('hex'),
      localMedia: true,
      siteOrigin: 'http://localhost:3000',
      imageOrigin: 'http://localhost:3000/media',
    });
    for (const input of planned) await app.get(PoliciesService).publish(input, options);
    const rows = await db.query(
      "SELECT policy_type,version_label,status,length(body_html) AS body_length FROM legal.policy_version WHERE version_label='v0.1' ORDER BY policy_type"
    );
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.status === 'EFFECTIVE' && row.body_length > 1000));
    console.log(
      `PASS local policy DB: inserted=${planned.length}, retained=${2 - planned.length}, EFFECTIVE=2; contact values omitted`
    );
    for (const row of rows)
      console.log(
        `${row.policy_type} ${row.version_label} ${row.status} body_length=${row.body_length}`
      );
  } finally {
    await app?.close();
    await db.destroy();
  }
}
main().catch(() => {
  console.error('FAIL local policy preparation or version conflict; no secret values printed');
  process.exitCode = 1;
});
