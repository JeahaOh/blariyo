import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Inject, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { UnitOfWork, type TransactionOptions } from '../shared/unit-of-work.js';
import { ApiError } from '../shared/errors.js';
import { entities } from './entities.js';

export function createDataSource(url: string, migration = false): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    entities,
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    logging: false,
    poolSize: 10,
    connectTimeoutMS: 5000,
    extra: {
      options: migration
        ? '-c timezone=UTC -c statement_timeout=300000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=60000'
        : '-c timezone=UTC -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000',
    },
  });
}

@Injectable()
export class DatabaseContext implements OnApplicationShutdown {
  private readonly scope = new AsyncLocalStorage<{
    runner: QueryRunner;
    pending: (() => void)[];
    committed: (() => void)[];
  }>();
  private readonly logger = new Logger(DatabaseContext.name);
  constructor(@Inject(DataSource) readonly source: DataSource) {}
  get manager() {
    return this.scope.getStore()?.runner.manager ?? this.source.manager;
  }
  afterCommit(notify: () => void): void {
    const active = this.scope.getStore();
    if (!active?.runner.isTransactionActive) throw new Error('AFTER_COMMIT_REQUIRES_TRANSACTION');
    active.pending.push(notify);
  }
  transactionFinished(committed: boolean): void {
    const active = this.scope.getStore();
    if (!active) throw new Error('TRANSACTION_CONTEXT_REQUIRED');
    const callbacks = active.pending.splice(0);
    if (committed) active.committed.push(...callbacks);
  }
  async connection<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const active = this.scope.getStore();
    if (active) return work(active.runner);
    const runner = this.source.createQueryRunner();
    await runner.connect();
    const state = { runner, pending: [] as (() => void)[], committed: [] as (() => void)[] };
    try {
      return await this.scope.run(state, () => work(runner));
    } finally {
      await runner.release();
      // Schedule outside AsyncLocalStorage, after outer session locks and connection
      // are released. A release failure skips notification; durable jobs still recover.
      if (state.committed.length) this.scope.exit(() => {
        setImmediate(() => {
          for (const notify of state.committed) {
            try { notify(); }
            catch { this.logger.warn('AFTER_COMMIT_NOTIFICATION_FAILED'); }
          }
        });
      });
    }
  }
  async onApplicationShutdown() {
    if (this.source.isInitialized) await this.source.destroy();
  }
}

@Injectable()
export class TypeOrmUnitOfWork extends UnitOfWork {
  constructor(@Inject(DatabaseContext) private readonly database: DatabaseContext) {
    super();
  }
  transaction<T>(work: () => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    return this.database.connection(async (runner) => {
      // Nested use cases reuse the same transaction; the owning boundary commits/rolls back.
      if (runner.isTransactionActive) return work();
      await runner.startTransaction(options.isolation ?? 'READ COMMITTED');
      try {
        if (options.readOnly) await runner.query('SET TRANSACTION READ ONLY');
        const result = await work();
        await runner.commitTransaction();
        this.database.transactionFinished(true);
        return result;
      } catch (error) {
        this.database.transactionFinished(false);
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        throw error;
      }
    });
  }
  afterCommit(notify: () => void): void {
    this.database.afterCommit(notify);
  }
  async transactionLock(key: string, wait = false): Promise<void> {
    const result: unknown = await this.database.manager.query(
      wait ? 'SELECT pg_advisory_xact_lock(hashtextextended($1,0))'
        : 'SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired', [key]);
    if (wait) return;
    const acquired = Array.isArray(result) && result.some((row: unknown) =>
      typeof row === 'object' && row !== null && 'acquired' in row && row.acquired === true);
    if (!acquired) throw new ApiError(409, 'IDEMPOTENCY_IN_PROGRESS');
  }
  lock<T>(key: string | number, work: () => Promise<T>, wait = true): Promise<T> {
    return this.database.connection(async (runner) => {
      const result: unknown = await runner.query(
        wait
          ? (typeof key === 'number' ? 'SELECT pg_advisory_lock($1::bigint)' : 'SELECT pg_advisory_lock(hashtextextended($1,0))')
          : (typeof key === 'number' ? 'SELECT pg_try_advisory_lock($1::bigint) AS acquired' : 'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired'),
        [key]
      );
      if (
        !wait &&
        (!Array.isArray(result) ||
          !result.some(
            (row: unknown) =>
              typeof row === 'object' && row !== null && 'acquired' in row && row.acquired === true
          ))
      )
        throw new ApiError(409, 'IDEMPOTENCY_IN_PROGRESS');
      try {
        return await work();
      } finally {
        await runner.query(typeof key === 'number' ? 'SELECT pg_advisory_unlock($1::bigint)' : 'SELECT pg_advisory_unlock(hashtextextended($1,0))', [key]);
      }
    });
  }
}
