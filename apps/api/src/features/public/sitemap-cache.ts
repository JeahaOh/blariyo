import { ApiError } from '../../shared/errors.js';

/** Bounded process-local cache. Only completed successes survive a request. */
export class SitemapCache {
  private readonly values = new Map<string, { body: Buffer; expires: number }>();
  private readonly pending = new Map<string, Promise<Buffer>>();
  constructor(private readonly now: () => number = Date.now) {}
  async get(key: string, create: () => Promise<Buffer>): Promise<Buffer> {
    for (const [name, entry] of this.values)
      if (entry.expires <= this.now()) this.values.delete(name);
    const found = this.values.get(key);
    if (found) {
      this.values.delete(key);
      this.values.set(key, found);
      return found.body;
    }
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= 4) throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE');
    const promise = Promise.resolve()
      .then(create)
      .then((body) => {
        // Start TTL at completion. Downstream responses are no-store to avoid another TTL.
        if (body.length <= 16 * 1024 * 1024) {
          this.values.set(key, { body, expires: this.now() + 300000 });
          let bytes = [...this.values.values()].reduce((sum, entry) => sum + entry.body.length, 0);
          for (const [name, entry] of this.values) {
            if (this.values.size <= 32 && bytes <= 16 * 1024 * 1024) break;
            this.values.delete(name);
            bytes -= entry.body.length;
          }
        }
        return body;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
