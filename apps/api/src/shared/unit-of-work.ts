export interface TransactionOptions {
  isolation?: 'READ COMMITTED' | 'REPEATABLE READ';
  readOnly?: boolean;
}
/** Work callbacks use injected repository contracts, never a driver/ORM connection. */
export abstract class UnitOfWork {
  abstract transaction<T>(work: () => Promise<T>, options?: TransactionOptions): Promise<T>;
  abstract transactionLock(key: string, wait?: boolean): Promise<void>;
  abstract lock<T>(key: string | number, work: () => Promise<T>, wait?: boolean): Promise<T>;
}
