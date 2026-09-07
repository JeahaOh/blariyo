// Session lock spans object storage I/O without holding an SQL transaction open.
// Every post mutation and attached-image deletion uses this same namespace.
export async function withPostLock(pool, postId, fn) {
  const client = await pool.connect();
  const key = `post-storage:${postId}`;
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [key]);
    locked = true;
    return await fn({
      query: client.query.bind(client),
      connect: async () => ({ query: client.query.bind(client), release() {} }),
    });
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [key]);
    } finally {
      client.release();
    }
  }
}
