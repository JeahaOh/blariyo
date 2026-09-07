import { transaction } from './db.mjs';
import { withPostLock } from './post-lock.mjs';
export async function enqueue(db, type, aggregateType, aggregateId, payload, actor, delay = 0) {
  await db.query(
    `INSERT INTO ops.outbox_task(type,status,aggregate_type,aggregate_id,payload,next_attempt_at,created_by,created_at,updated_by,updated_at)
 VALUES($1,'PENDING',$2,$3,$4,now()+$6*interval '1 second',$5,now(),$5,now())`,
    [type, aggregateType, aggregateId, payload, actor, delay]
  );
}
export async function runOutbox(pool, storage, cache, { limit = 100 } = {}) {
  const actor = 'system:outbox-worker';
  await pool.query(
    `UPDATE ops.outbox_task SET status=CASE WHEN attempt_count+1>=8 THEN 'DEAD' ELSE 'FAILED' END,attempt_count=attempt_count+1,
 next_attempt_at=now()+power(2,attempt_count+1)*interval '1 minute',last_error_code='LEASE_EXPIRED',updated_by=$1,updated_at=now() WHERE status='RUNNING' AND updated_at<now()-interval '5 minutes'`,
    [actor]
  );
  let processed = 0;
  while (processed < limit) {
    const task = await transaction(
      pool,
      async (db) =>
        (
          await db.query(
            `UPDATE ops.outbox_task SET status='RUNNING',updated_by=$1,updated_at=clock_timestamp() WHERE id=(SELECT id FROM ops.outbox_task WHERE status IN ('PENDING','FAILED') AND next_attempt_at<=now() ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
            [actor]
          )
        ).rows[0]
    );
    if (!task) break;
    processed++;
    try {
      const execute = async (pool) => {
        // A lease may have been reclaimed while waiting for the post lock.
        const current = await pool.query(
          "SELECT 1 FROM ops.outbox_task WHERE id=$1 AND status='RUNNING' AND updated_at=$2",
          [task.id, task.updated_at]
        );
        if (!current.rowCount) return;
        let deleteObject = true;
        if (task.type === 'OBJECT_DELETE_PUBLIC') {
          const image = (
            await pool.query('SELECT * FROM content.board_post_image WHERE public_storage_key=$1', [
              task.payload.publicStorageKey,
            ])
          ).rows[0];
          deleteObject =
            task.aggregate_type === 'IMAGE' && !task.payload.compensation
              ? image?.status === 'PUBLIC_DELETE_PENDING' &&
                String(image.id) === String(task.aggregate_id)
              : image?.status !== 'PUBLIC';
        }
        if (task.type === 'CACHE_PURGE') await cache.purge(task.payload.urls);
        if (task.type === 'OBJECT_DELETE_PUBLIC' && deleteObject) {
          await storage.delete('public', task.payload.publicStorageKey);
          await cache.purge([task.payload.publicUrl]);
        }
        if (task.type === 'OBJECT_DELETE_PRIVATE')
          await storage.delete('private', task.payload.privateStorageKey);
        await transaction(pool, async (db) => {
          const claim = await db.query(
            "SELECT id FROM ops.outbox_task WHERE id=$1 AND status='RUNNING' AND updated_at=$2 FOR UPDATE",
            [task.id, task.updated_at]
          );
          if (!claim.rowCount) return;
          if (task.aggregate_type === 'IMAGE') {
            if (task.type === 'OBJECT_DELETE_PUBLIC' && !task.payload.compensation)
              await db.query(
                "UPDATE content.board_post_image SET status='PRIVATE_REVIEW',public_storage_key=NULL,updated_by=$2,updated_at=now() WHERE id=$1 AND status='PUBLIC_DELETE_PENDING'",
                [task.aggregate_id, actor]
              );
            if (task.type === 'OBJECT_DELETE_PRIVATE')
              await db.query(
                "UPDATE content.board_post_image SET status='DELETED',updated_by=$2,updated_at=now() WHERE id=$1 AND status='PRIVATE_DELETE_PENDING'",
                [task.aggregate_id, actor]
              );
          }
          await db.query(
            "UPDATE ops.outbox_task SET status='SUCCEEDED',updated_at=now(),last_error_code=NULL WHERE id=$1",
            [task.id]
          );
        });
      };
      const image =
        task.aggregate_type === 'IMAGE'
          ? (
              await pool.query('SELECT post_id FROM content.board_post_image WHERE id=$1', [
                task.aggregate_id,
              ])
            ).rows[0]
          : null;
      const postId =
        image?.post_id || /^posts\/(\d+)\//.exec(task.payload.publicStorageKey || '')?.[1];
      if (postId) await withPostLock(pool, postId, execute);
      else await execute(pool);
    } catch {
      await pool.query(
        `UPDATE ops.outbox_task SET attempt_count=attempt_count+1,status=CASE WHEN attempt_count+1>=8 THEN 'DEAD' ELSE 'FAILED' END,
   next_attempt_at=now()+power(2,attempt_count+1)*interval '1 minute',last_error_code='EXTERNAL_OPERATION_FAILED',updated_at=now() WHERE id=$1 AND status='RUNNING' AND updated_at=$2`,
        [task.id, task.updated_at]
      );
    }
  }
  return processed;
}
