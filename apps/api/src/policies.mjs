import { createHash } from 'node:crypto';
import sanitize from 'sanitize-html';
import { canonical } from './posts.mjs';
import { transaction } from './db.mjs';
import { enqueue } from './outbox.mjs';
export function artifactChecksum(artifact) {
  const { checksum, ...payload } = artifact;
  return createHash('sha256')
    .update(JSON.stringify(canonical(payload)))
    .digest('hex');
}
export function assertLegalConfig(config) {
  for (const key of [
    'operatorDisplayName',
    'contactEmail',
    'rightsEmail',
    'privacyEmail',
    'privacyOfficer',
  ]) {
    if (
      typeof config[key] !== 'string' ||
      !config[key].trim() ||
      /미정|입력 필요|출시 차단|\.invalid\b/.test(config[key])
    )
      throw new Error('LEGAL_CONFIG_REQUIRED');
    if (key.endsWith('Email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config[key]))
      throw new Error('LEGAL_CONFIG_REQUIRED');
  }
}
export async function publishPolicy(
  pool,
  artifact,
  {
    now = new Date(),
    production = false,
    legalConfig = {},
    siteOrigin = 'http://localhost:3000',
  } = {}
) {
  if (
    !artifact ||
    !['terms', 'privacy'].includes(artifact.type) ||
    typeof artifact.version !== 'string' ||
    artifact.version.length > 20 ||
    !artifact.version.trim() ||
    typeof artifact.title !== 'string' ||
    !artifact.title.trim() ||
    artifact.title.length > 200 ||
    typeof artifact.body !== 'string' ||
    !artifact.body.trim() ||
    artifact.body.length > 1000000
  )
    throw new Error('INVALID_POLICY_ARTIFACT');
  if (artifact.checksum !== artifactChecksum(artifact)) throw new Error('POLICY_CHECKSUM_MISMATCH');
  const effective = new Date(artifact.effectiveAt);
  if (!Number.isFinite(+effective) || effective > now || now - effective > 300000)
    throw new Error('POLICY_EFFECTIVE_WINDOW');
  if (production) {
    assertLegalConfig(legalConfig);
    if (/\[입력 필요|\[출시 차단/.test(artifact.body)) throw new Error('POLICY_PLACEHOLDER');
  }
  const body = sanitize(artifact.body, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'p',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'a',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'br',
      'blockquote',
    ],
    allowedAttributes: { a: ['href', 'rel'] },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  });
  if (!sanitize(body, { allowedTags: [], allowedAttributes: {} }).trim())
    throw new Error('INVALID_POLICY_ARTIFACT');
  return transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'policy:' + artifact.type,
    ]);
    const same = (
      await db.query(
        'SELECT * FROM legal.policy_version WHERE policy_type=$1 AND version_label=$2',
        [artifact.type.toUpperCase(), artifact.version]
      )
    ).rows[0];
    if (same) {
      if (
        same.body_html === body &&
        same.title === artifact.title &&
        +same.effective_at === +effective
      )
        return artifact.version;
      throw new Error('POLICY_VERSION_CONFLICT');
    }
    const current = (
      await db.query(
        "SELECT * FROM legal.policy_version WHERE policy_type=$1 AND status='EFFECTIVE'",
        [artifact.type.toUpperCase()]
      )
    ).rows[0];
    if (current && current.effective_at >= effective) throw new Error('POLICY_EFFECTIVE_ORDER');
    await db.query(
      "UPDATE legal.policy_version SET status='RETIRED',ended_at=$2,updated_by='system:policy-publisher',updated_at=now() WHERE policy_type=$1 AND status='EFFECTIVE'",
      [artifact.type.toUpperCase(), effective]
    );
    const row = (
      await db.query(
        `INSERT INTO legal.policy_version(policy_type,version_label,title,body_html,status,effective_at,created_by,created_at,updated_by,updated_at) VALUES($1,$2,$3,$4,'EFFECTIVE',$5,'system:policy-publisher',now(),'system:policy-publisher',now()) RETURNING id`,
        [artifact.type.toUpperCase(), artifact.version, artifact.title, body, effective]
      )
    ).rows[0];
    await enqueue(
      db,
      'CACHE_PURGE',
      'POLICY',
      row.id,
      {
        urls: [`${siteOrigin}/api/v1/policies/${artifact.type}`, `${siteOrigin}/${artifact.type}`],
      },
      'system:policy-publisher'
    );
    return artifact.version;
  });
}
