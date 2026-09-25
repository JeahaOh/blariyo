import { mkdir, writeFile } from 'node:fs/promises';
import { createDataSource } from '../../apps/api/dist/persistence/database.js';

const refs = {
  arcalive: 'https://arca.live/',
  bobaedream: 'https://www.bobaedream.co.kr/',
  clien: 'https://www.clien.net/',
  dcinside: 'https://www.dcinside.com/',
  dmitory: 'https://www.dmitory.com/',
  dogdrip: 'https://www.dogdrip.net/',
  etoland: 'https://etoland.co.kr/',
  fmkorea: 'https://www.fmkorea.com/',
  goodgag: 'https://www.goodgag.net/',
  humoruniv: 'https://web.humoruniv.com/',
  instiz: 'https://www.instiz.net/',
  inven: 'https://www.inven.co.kr/',
  mlbpark: 'https://mlbpark.donga.com/',
  natepann: 'https://pann.nate.com/',
  pgr21: 'https://pgr21.com/',
  ppomppu: 'https://www.ppomppu.co.kr/',
  ruliweb: 'https://bbs.ruliweb.com/',
  theqoo: 'https://theqoo.net/',
  todayhumor: 'https://www.todayhumor.co.kr/',
  yuldo: 'https://yul-do.com/',
};
const result = [];
for (const [site, url] of Object.entries(refs)) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'blariyo-collector contact-dev@example.invalid' },
    });
    result.push({ site, url, httpStatus: response.status, reachable: response.ok });
  } catch (error) {
    result.push({ site, url, reachable: false, error: String(error) });
  }
}
const db = await createDataSource(
  'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local'
).initialize();
const rows = await db.query(
  `SELECT s.name,s.host,c.id candidate_id,c.status,c.post_id,p.status post_status FROM collect.source s LEFT JOIN collect.candidate c ON c.source_id=s.id LEFT JOIN content.board_post p ON p.id=c.post_id ORDER BY s.id`
);
await db.destroy();
const report = { generatedAt: new Date().toISOString(), references: result, database: rows };
await mkdir('.local-data/content-review', { recursive: true });
const path = `.local-data/content-review/reference-site-audit-${Date.now()}.json`;
await writeFile(path, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(
  JSON.stringify({
    path,
    references: result.length,
    dbSources: new Set(rows.map((r) => r.host)).size,
    published: rows.filter((r) => r.post_status === 'PUBLISHED').length,
  })
);
