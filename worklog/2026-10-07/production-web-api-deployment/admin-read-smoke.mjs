// Internal Core API read-only smoke; this does not validate browser MFA.
const headers={'X-Blariyo-Service-Token':process.env.SERVICE_TOKEN,'X-Blariyo-Admin-Actor':'admin:v1:'+'D'.repeat(43),'X-Blariyo-Admin-Role':'OWNER'};
async function get(path){const r=await fetch('http://127.0.0.1:4000'+path,{headers,signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok)throw Error(`HTTP_${r.status}:${path}`);return j;}
const codes=await get('/api/v1/admin/common-code-groups/source/codes');
if(codes.data.items.length!==21)throw Error('CODE_COUNT');
const list=await get('/api/v1/admin/collect/batch-items?source=goodgag&state=FETCHED&reviewStatus=UNREVIEWED');
if(!list.data.items.length)throw Error('LIST_EMPTY');
const item=list.data.items.find(x=>x.fetchedAt&&x.fetchedAt.startsWith('2026-10-07'));
if(!item)throw Error('FETCHED_AT_MISSING');
const detail=await get('/api/v1/admin/collect/batch-items/'+item.itemId);
const value=detail.data.item??detail.data;
if(!value.canonicalUrl||!value.fetchedAt)throw Error('DETAIL_FIELDS_MISSING');
let preview;
for(const row of list.data.items.filter(x=>x.fetchedAt?.startsWith('2026-10-07'))){
 const d=(await get('/api/v1/admin/collect/batch-items/'+row.itemId)).data.item;
 const media=d.media.find(x=>x.kind==='IMAGE');if(!media)continue;
 const r=await fetch('http://127.0.0.1:4000/api/v1/admin/collect/batch-items/'+row.itemId+'/media/'+media.position+'/preview',{headers,signal:AbortSignal.timeout(15000)});
 const bytes=(await r.arrayBuffer()).byteLength;if(!r.ok||!bytes||!r.headers.get('content-type')?.startsWith('image/'))throw Error('MEDIA_PREVIEW_FAILED');
 preview={status:r.status,bytes,cache:r.headers.get('cache-control')};break;
}
if(!preview)throw Error('MEDIA_SAMPLE_MISSING');
console.log(JSON.stringify({preview,commonCodes:codes.data.items.length,listItems:list.data.items.length,itemId:item.itemId,fetchedAt:value.fetchedAt,bodyBlocks:value.bodyBlocks?.length,media:value.media?.length,scope:'internal API read-only; browser MFA not exercised'}));
