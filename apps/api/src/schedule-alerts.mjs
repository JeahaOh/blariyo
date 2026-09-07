// Durable grouping survives cron process restarts; delivery has at-least-once semantics.
export async function recordScheduleFailure(pool, post, code, attemptedAt = new Date()) {
  const errorCode = /^[A-Z_]{1,80}$/.test(code || '') ? code : 'DEPENDENCY_UNAVAILABLE';
  const event = {
    event: 'SCHEDULE_FAILED',
    postId: Number(post.id),
    scheduledAt: post.scheduled_at.toISOString(),
    errorCode,
    attemptedAt: attemptedAt.toISOString(),
  };
  console.error(JSON.stringify(event));
  await pool.query(
    `INSERT INTO ops.schedule_failure_alert(post_id,scheduled_at,error_code,attempt_count,first_attempt_at,last_attempt_at)
    VALUES($1,$2,$3,1,$4,$4) ON CONFLICT(post_id,scheduled_at,error_code) DO UPDATE SET
    attempt_count=schedule_failure_alert.attempt_count+1,last_attempt_at=GREATEST(schedule_failure_alert.last_attempt_at,$4),updated_at=now()`,
    [post.id, post.scheduled_at, errorCode, attemptedAt]
  );
}
export function scheduleWebhook(url = process.env.SCHEDULE_ALERT_WEBHOOK_URL) {
  return async (event) => {
    if (!url) throw new Error('SCHEDULE_ALERT_NOT_CONFIGURED');
    const target = new URL(url);
    if (
      target.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV !== 'production' &&
        target.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
      )
    )
      throw new Error('SCHEDULE_ALERT_URL_INVALID');
    // No redirects: never forward a configured webhook secret to a new host.
    const result = await fetch(target, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10000),
    });
    await result.body?.cancel();
    if (!result.ok) throw new Error('SCHEDULE_ALERT_DELIVERY_FAILED');
  };
}
export async function deliverScheduleAlerts(pool, send, now = new Date()) {
  const client = await pool.connect();
  let locked = false,
    delivered = 0;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(72498132) AS locked')).rows[0].locked;
    if (!locked) return 0;
    const rows = (
      await client.query(
        `SELECT * FROM ops.schedule_failure_alert WHERE attempt_count>notified_count
      AND (notified_at IS NULL OR notified_at<=$1::timestamptz-interval '15 minutes') ORDER BY first_attempt_at,post_id`,
        [now]
      )
    ).rows;
    let failed = false;
    for (const row of rows) {
      try {
        await send({
          event: 'SCHEDULE_FAILED',
          groupKey: `${row.post_id}:${row.scheduled_at.toISOString()}:${row.error_code}`,
          postId: Number(row.post_id),
          scheduledAt: row.scheduled_at.toISOString(),
          errorCode: row.error_code,
          attemptedAt: row.last_attempt_at.toISOString(),
          firstAttemptAt: row.first_attempt_at.toISOString(),
          attemptCount: row.attempt_count,
          newAttempts: row.attempt_count - row.notified_count,
        });
        await client.query(
          `UPDATE ops.schedule_failure_alert SET notified_count=$4,notified_at=$5,updated_at=now()
          WHERE post_id=$1 AND scheduled_at=$2 AND error_code=$3`,
          [row.post_id, row.scheduled_at, row.error_code, row.attempt_count, now]
        );
        delivered++;
      } catch {
        failed = true;
      }
    }
    if (failed) throw new Error('SCHEDULE_ALERT_DELIVERY_FAILED');
    return delivered;
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(72498132)');
    } finally {
      client.release();
    }
  }
}
