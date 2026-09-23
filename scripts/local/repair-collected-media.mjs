// Fixed local target only. Default is read-only; --apply and --rollback are explicit.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';

const root = resolve('.local-data/media');
const manifestPath = resolve('.local-data/repairs/collected-media-v1.json');
const backupRoot = resolve('.local-data/repairs/collected-media-v1-objects');
const databaseUrl = 'postgresql://blariyo_local@127.0.0.1:5439/blariyo_local';
function objectPath(bucket, key) {
  const base = resolve(root, bucket), path = resolve(base, key);
  if (!path.startsWith(base + sep)) throw Error('INVALID_OBJECT_KEY');
  return path;
}
async function optionalRead(path) {
  try { return await readFile(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
export async function verifyImage(bytes, row) {
  if (!bytes || bytes.length !== row.byte_size || createHash('sha256').update(bytes).digest('hex') !== row.hash)
    throw Error('IMAGE_BYTES_MISMATCH');
  const decoder = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
  const metadata = await decoder.metadata();
  const mime = {jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[metadata.format];
  if (mime !== row.mime_type || metadata.width !== row.width || (metadata.pageHeight || metadata.height) !== row.height)
    throw Error('IMAGE_METADATA_MISMATCH');
  const frames=metadata.pages||1;
  if (frames>1000 || metadata.width*(metadata.pageHeight||metadata.height)*frames*4>256*1024*1024)
    throw Error('IMAGE_DECODE_BUDGET_EXCEEDED');
  // Offline recovery allows existing animations within an explicit 256 MiB RGBA budget.
  // The normal upload validator remains unchanged; this never truncates animation frames.
  await sharp(bytes,{animated:true,limitInputPixels:64*1024*1024,failOn:'warning'}).stats();
}
export async function repair(mode) {
  if (!['--dry-run','--apply','--rollback'].includes(mode)) throw Error('EXPECTED_DRY_RUN_APPLY_OR_ROLLBACK');
  const client = new pg.Client({connectionString:databaseUrl});
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(72498132)');
    const current = (await client.query(`SELECT id::text,post_id::text,private_storage_key,public_storage_key,
      encode(content_sha256,'hex') AS hash,mime_type,byte_size,width,height FROM content.board_post_image
      WHERE status='PUBLIC' AND public_storage_key LIKE 'content/published/posts/%' ORDER BY id`)).rows;
    const saved = await optionalRead(manifestPath);
    const manifest = saved ? JSON.parse(saved) : {version:1, database:'blariyo_local', entries:[]};
    if (!saved) for (const row of current) {
      const bytes=await readFile(objectPath('public',row.public_storage_key));
      const metadata=await sharp(bytes,{animated:true}).metadata();
      const targetMime={jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[metadata.format];
      if (!targetMime) throw Error('UNSUPPORTED_IMAGE_FORMAT');
      const ext=metadata.format==='jpeg'?'jpg':metadata.format;
      manifest.entries.push({...row,targetMime,
        target:`content/private/recovered/${row.id}-${row.hash}.${ext}`,
        targetPublic:`content/published/posts/${row.post_id}/${row.id}-${row.hash}.${ext}`});
    }
    if (manifest.version !== 1 || manifest.database !== 'blariyo_local' || !Array.isArray(manifest.entries))
      throw Error('INVALID_MANIFEST');
    if (mode === '--rollback' && !saved) throw Error('MANIFEST_REQUIRED');
    // Validate all inputs before writes. Backup files are outside the served storage tree.
    const prepared = [];
    for (const entry of manifest.entries) {
      if (!/^[1-9][0-9]*$/.test(entry.id)) throw Error('INVALID_MANIFEST');
      const row=current.find(row=>row.id===entry.id);
      if (!row || row.hash!==entry.hash || ![entry.public_storage_key,entry.targetPublic].includes(row.public_storage_key) ||
          ![entry.private_storage_key,entry.target].includes(row.private_storage_key) ||
          ![entry.mime_type,entry.targetMime].includes(row.mime_type)) throw Error('ROW_CHANGED');
      const backupPath=resolve(backupRoot,entry.id);
      const publicBytes=await optionalRead(backupPath) ?? await readFile(objectPath('public',entry.public_storage_key));
      const expected={...entry,mime_type:entry.targetMime};
      await verifyImage(publicBytes,expected);
      const targetBytes=await optionalRead(objectPath('private',entry.target));
      if (targetBytes) await verifyImage(targetBytes,expected);
      const targetPublicBytes=await optionalRead(objectPath('public',entry.targetPublic));
      if (targetPublicBytes) await verifyImage(targetPublicBytes,expected);
      const original=await optionalRead(objectPath('private',entry.private_storage_key));
      if (original) await verifyImage(original,expected);
      prepared.push({entry,publicBytes,targetBytes,backupPath});
    }
    if (mode==='--dry-run') return {mode,planned:prepared.length,missingPrivate:prepared.filter(x=>!x.targetBytes).length,
      mimeCorrections:prepared.filter(x=>x.entry.mime_type!==x.entry.targetMime).length};
    async function createVerified(path,bytes,expected) {
      await mkdir(dirname(path),{recursive:true,mode:0o700});
      try {await writeFile(path,bytes,{flag:'wx',mode:0o600});} catch(error) {if(error.code!=='EEXIST')throw error;}
      await verifyImage(await readFile(path),expected);
    }
    for (const {entry,publicBytes,backupPath} of prepared)
      await createVerified(backupPath,publicBytes,{...entry,mime_type:entry.targetMime});
    if (!saved) {
      await mkdir(dirname(manifestPath),{recursive:true,mode:0o700});
      await writeFile(manifestPath,JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
    }
    let changed=0;
    for (const {entry,publicBytes} of prepared) {
      const applying=mode==='--apply',expected={...entry,mime_type:entry.targetMime};
      const from=applying?entry.private_storage_key:entry.target;
      const to=applying?entry.target:entry.private_storage_key;
      const publicKey=applying?entry.targetPublic:entry.public_storage_key;
      const mime=applying?entry.targetMime:entry.mime_type;
      await createVerified(objectPath('public',publicKey),publicBytes,expected);
      if (applying) await createVerified(objectPath('private',entry.target),publicBytes,expected);
      const result=await client.query(`UPDATE content.board_post_image SET private_storage_key=$1,public_storage_key=$2,mime_type=$3
        WHERE id=$4 AND private_storage_key=$5 AND encode(content_sha256,'hex')=$6 AND status='PUBLIC'
        AND public_storage_key=$7 AND mime_type=$8`,
        [to,publicKey,mime,entry.id,from,entry.hash,applying?entry.public_storage_key:entry.targetPublic,applying?entry.mime_type:entry.targetMime]);
      if (!result.rowCount) {
        const found=(await client.query('SELECT private_storage_key,public_storage_key,mime_type FROM content.board_post_image WHERE id=$1',[entry.id])).rows[0];
        if (found?.private_storage_key!==to || found.public_storage_key!==publicKey || found.mime_type!==mime) throw Error('ROW_CHANGED');
      }
      changed+=result.rowCount;
      const obsolete=applying?entry.public_storage_key:entry.targetPublic;
      if (obsolete!==publicKey) {
        const path=objectPath('public',obsolete),bytes=await optionalRead(path);
        if(bytes){await verifyImage(bytes,expected);await unlink(path);}
      }
      if (!applying) {
        const path=objectPath('private',entry.target),bytes=await optionalRead(path);
        if(bytes){await verifyImage(bytes,expected);await unlink(path);}
      }
    }
    return {mode,verified:prepared.length,changed};
  } finally {await client.end();}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length>3) throw Error('UNEXPECTED_ARGUMENTS');
    console.log(JSON.stringify(await repair(process.argv[2]||'--dry-run')));
  } catch (error) {
    console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message)?error.message:'LOCAL_REPAIR_FAILED');
    process.exitCode=1;
  }
}
