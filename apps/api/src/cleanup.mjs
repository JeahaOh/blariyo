import { transaction } from './db.mjs';
import { withPostLock } from './post-lock.mjs';
import { enqueue } from './outbox.mjs';
export async function cleanup(pool, storage) {
  const actor = 'system:outbox-worker';
  await transaction(pool, async (db) => {
    const staged = (
      await db.query(
        "SELECT * FROM content.board_post_image WHERE post_id IS NULL AND status='STAGED' AND updated_at<now()-interval '24 hours' FOR UPDATE SKIP LOCKED"
      )
    ).rows;
    for (const image of staged) {
      await db.query(
        "UPDATE content.board_post_image SET status='PRIVATE_DELETE_PENDING',updated_by=$2,updated_at=now() WHERE id=$1",
        [image.id, actor]
      );
      await enqueue(
        db,
        'OBJECT_DELETE_PRIVATE',
        'IMAGE',
        image.id,
        { privateStorageKey: image.private_storage_key },
        actor
      );
    }
    await db.query('DELETE FROM ops.idempotency_request WHERE expires_at<now()');
  });
  for (const bucket of ['private', 'public'])
    for (const object of await storage.inventory(bucket)) {
      if (Date.now() - object.createdAt < 86400000) continue;
      if (bucket === 'private' && !object.key.startsWith('staging/')) continue;
      const column = bucket === 'private' ? 'private_storage_key' : 'public_storage_key';
      const removeOrphan = async (pool) => {
        const referenced = await pool.query(
          `SELECT 1 FROM content.board_post_image WHERE ${column}=$1 AND status<>'DELETED' UNION ALL SELECT 1 FROM ops.outbox_task WHERE status IN ('PENDING','RUNNING','FAILED','DEAD') AND (payload->>'privateStorageKey'=$1 OR payload->>'publicStorageKey'=$1) LIMIT 1`,
          [object.key]
        );
        if (!referenced.rowCount) await storage.delete(bucket, object.key);
      };
      const postId = bucket === 'public' && /^posts\/(\d+)\//.exec(object.key)?.[1];
      if (postId) await withPostLock(pool, postId, removeOrphan);
      else await removeOrphan(pool);
    }
}
