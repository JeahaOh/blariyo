import crypto from 'node:crypto';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';

const [name, url, code] = process.argv.slice(2);
if (!name || !url || !code || !url.startsWith('https://')) throw new Error('Usage: node record-reference-failure.mjs <name> <url> <errorCode>');
let httpStatus = null;
try { const response = await fetch(url, { headers: { 'user-agent': 'blariyo-collector contact-dev@example.invalid' } }); httpStatus = response.status; } catch {}
const db = await createDataSource('postgresql://blariyo_local@127.0.0.1:5439/blariyo_local').initialize();
try {
  const host = new URL(url).host;
  let sourceId = (await db.query('SELECT id FROM collect.source WHERE host=$1', [host]))[0]?.id;
  if (!sourceId) sourceId = (await db.query(`INSERT INTO collect.source(name,base_url,host,fetch_mode,parser_type,is_active,robots_allowed,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES($1,$2,$3,'URL_ONLY','MANUAL',false,NULL,1000,10,'system:collector','system:collector') RETURNING id`, [name, `${new URL(url).protocol}//${host}`, host]))[0].id;
  const hash = crypto.createHash('sha256').update(url).digest();
  await db.query(`INSERT INTO collect.candidate(source_id,origin_url,origin_url_sha256,title,parser_version,warnings,status,discovery_mode,fetch_error_code,fetched_at,created_by,updated_by) VALUES($1,$2,$3,NULL,'jsoup-1.23.2-v1',$4::jsonb,'FETCH_FAILED','MANUAL_URL',$5,now(),'system:collector','system:collector') ON CONFLICT(origin_url_sha256) DO UPDATE SET status='FETCH_FAILED',fetch_error_code=EXCLUDED.fetch_error_code,fetched_at=now(),updated_by='system:collector',updated_at=now()`, [sourceId, url, hash, JSON.stringify([code, ...(httpStatus ? [`HTTP_${httpStatus}`] : [])]), code]);
  console.log(JSON.stringify({ name, url, httpStatus, status: 'FETCH_FAILED', code }));
} finally { await db.destroy(); }
