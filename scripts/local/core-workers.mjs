import { createDataSource } from '../../apps/api/dist/persistence/database.js';
import { runCommand } from '../../apps/api/dist/commands/command.js';

// One owner per isolated database, including competing launcher processes.
export async function startCoreWorkers({
  databaseUrl,
  storageRoot,
  origin,
  intervalMs,
  report = console.log,
  fatal = () => {},
}) {
  const database = await createDataSource(databaseUrl).initialize();
  const lock = database.createQueryRunner();
  let acquired = false;
  try {
    await lock.connect();
    const [row] = await lock.query(
      "SELECT pg_try_advisory_lock(hashtext('blariyo-local-core-workers')) AS acquired"
    );
    if (!row.acquired) throw new Error('LOCAL_WORKERS_ALREADY_RUNNING');
    acquired = true;
  } catch (error) {
    await lock.release();
    await database.destroy();
    throw error;
  }
  let stopped = false,
    timer,
    current = Promise.resolve();
  // Intentionally do not inherit remote storage, notification or collector configuration.
  const env = {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    STORAGE_ROOT: storageRoot,
    SITE_ORIGIN: origin,
    IMAGE_ORIGIN: origin + '/media',
  };
  async function cycle() {
    // Losing the lock session invalidates ownership: stop instead of silently reconnecting.
    try {
      await lock.query('SELECT 1');
    } catch {
      stopped = true;
      report('LOCAL_WORKER_LOCK_LOST');
      fatal();
      return;
    }
    for (const command of ['posts:publish-due', 'outbox:run']) {
      if (stopped) break;
      try {
        await runCommand(command, [], env);
        report(`LOCAL_WORKER_OK ${command}`);
      } catch {
        // A failed command does not suppress the other queue or future ticks.
        report(`LOCAL_WORKER_RETRY ${command}`);
      }
    }
  }
  function next() {
    current = cycle().finally(() => {
      if (!stopped) timer = setTimeout(next, intervalMs);
    });
  }
  next();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await current;
    try {
      if (acquired)
        await lock.query("SELECT pg_advisory_unlock(hashtext('blariyo-local-core-workers'))");
    } finally {
      await lock.release();
      await database.destroy();
    }
  };
}
