// Development-only metadata batch for approved reference fixtures.
// It uses the same source/candidate/post services as the collector readback path.
import crypto from 'node:crypto';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { createNestApplication } from '../../apps/api/dist/bootstrap/application.js';
import { ImagesService } from '../../apps/api/dist/features/images/images.service.js';
import { PostsService } from '../../apps/api/dist/features/posts/posts.service.js';
import { UnitOfWork } from '../../apps/api/dist/shared/unit-of-work.js';

const [site, name, url] = process.argv.slice(2);
if (!site || !name || !url) throw new Error('Usage: node metadata-batch.mjs <site> <name> <url>');
const actor = 'system:collector';
const response = await fetch(url, { headers: { 'user-agent': 'blariyo-collector contact-dev@example.invalid' } });
if (!response.ok) throw new Error(`FETCH_${response.status}`);
const html = await response.text();
const meta = (key) => html.match(new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)`, 'i'))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'))?.[1] ?? null;
const title = (meta('og:title') ?? html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
const rawImage = meta('og:image') ?? html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)/i)?.[1] ?? null;
const image = rawImage?.startsWith('http://') ? `https://${rawImage.slice(7)}` : rawImage;
if (!title || !image) throw new Error('PARSE_FAILED_OG_METADATA');
if (!image.startsWith('https://')) throw new Error('IMAGE_URL_NOT_HTTPS');
const databaseUrl = 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local';
const db = await createDataSource(databaseUrl).initialize();
let candidateId, postId;
try {
  await db.transaction(async (manager) => {
    let sourceId = (await manager.query('SELECT id FROM collect.source WHERE host=$1', [new URL(url).host]))[0]?.id;
    if (!sourceId) sourceId = (await manager.query(`INSERT INTO collect.source(name,base_url,host,fetch_mode,parser_type,is_active,robots_allowed,robots_checked_at,request_interval_ms,daily_fetch_limit,created_by,updated_by) VALUES($1,$2,$3,'URL_ONLY','MANUAL',true,true,now(),1000,10,'system:collector','system:collector') RETURNING id`, [name, `${new URL(url).protocol}//${new URL(url).host}`, new URL(url).host]))[0].id;
    const hash = crypto.createHash('sha256').update(url).digest();
    const old = (await manager.query('SELECT id,post_id FROM collect.candidate WHERE origin_url_sha256=$1', [hash]))[0];
    if (old) { candidateId = old.id; postId = old.post_id; return; }
    candidateId = (await manager.query(`INSERT INTO collect.candidate(source_id,origin_url,origin_url_sha256,title,parser_version,warnings,content_blocks,status,discovery_mode,fetched_at,created_by,updated_by) VALUES($1,$2,$3,$4,'jsoup-1.23.2-v1','[]'::jsonb,$5::jsonb,'NEW','MANUAL_URL',now(),'system:collector','system:collector') RETURNING id`, [sourceId, url, hash, title, JSON.stringify([{ type: 'TEXT', text: title }, { type: 'IMAGE', imageUrl: image }])]))[0].id;
  });
  if (!postId) {
    const app = await createNestApplication({ databaseUrl, serviceToken: `dev-${site}`, localMedia: true, siteOrigin: 'http://127.0.0.1:3000', imageOrigin: 'http://127.0.0.1:3000/media' });
    try {
      const imageResponse = await fetch(image);
      if (!imageResponse.ok) throw new Error(`IMAGE_FETCH_${imageResponse.status}`);
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      const detectedMime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
        : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
          : imageResponse.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      const images = app.get(ImagesService), posts = app.get(PostsService), work = app.get(UnitOfWork);
      const uploaded = await images.upload([{ bytes, mime: detectedMime }], actor);
      const imageId = uploaded.items[0].imageId;
      const draft = await work.transaction(() => posts.createDraftInTransaction({ boardSlug: 'meme', title, source: { name, url }, pinnedPosition: null, blocks: [{ type: 'TEXT', text: title }, { type: 'IMAGE', imageId, alt: title }] }, actor));
      postId = draft.postId;
      await posts.command({ action: 'publish', params: { postId: String(postId) }, body: { mode: 'IMMEDIATE', lockVersion: draft.lockVersion } }, actor, `metadata-${site}-${postId}`, 'metadata-batch');
      await db.query(`INSERT INTO collect.candidate_image(candidate_id,position,remote_url,image_id,status,created_by,updated_by) VALUES($1,1,$2,$3,'STORED',$4,$4)`, [candidateId, image, imageId, actor]);
      await db.query(`UPDATE collect.candidate SET status='APPROVED',post_id=$1,reviewed_at=now(),updated_by=$2,updated_at=now() WHERE id=$3`, [postId, actor, candidateId]);
    } finally { await app.close(); }
  }
  console.log(JSON.stringify({ site, candidateId, postId, title, image, status: 'PUBLISHED' }));
} finally { await db.destroy(); }
