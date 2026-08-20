function errorCode(error) {
  const value = typeof error?.message === 'string' ? error.message : 'UNKNOWN_ERROR';
  return /^[A-Z0-9_]{1,50}$/.test(value) ? value : 'DEPENDENCY_ERROR';
}

function requiredPayloadString(task, field) {
  const value = task.payload?.[field];
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) {
    throw new Error('OUTBOX_PAYLOAD_INVALID');
  }
  return value;
}

class OutboxProcessor {
  constructor({ outboxRepository, privateMediaStorage, publicMediaStorage, cachePurge, clock = () => new Date() }) {
    this.repository = outboxRepository;
    this.privateMediaStorage = privateMediaStorage;
    this.publicMediaStorage = publicMediaStorage;
    this.cachePurge = cachePurge;
    this.clock = clock;
  }

  async processBatch({ limit = 100 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('limit must be an integer between 1 and 1000');
    }
    const startedAt = this.clock();
    const recovered = await this.repository.recoverStale(startedAt);
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    while (processed < limit) {
      const task = await this.repository.claimNext(this.clock());
      if (!task) break;
      processed += 1;
      try {
        await this.execute(task);
        await this.repository.complete(task, this.clock());
        succeeded += 1;
      } catch (error) {
        await this.repository.fail(task.id, errorCode(error), this.clock());
        failed += 1;
      }
    }
    return { recovered, processed, succeeded, failed };
  }

  async execute(task) {
    if (task.type === 'CACHE_PURGE') {
      if (!Array.isArray(task.payload?.paths)
        || task.payload.paths.length < 1
        || task.payload.paths.some((path) => typeof path !== 'string' || !path.startsWith('/'))) {
        throw new Error('OUTBOX_PAYLOAD_INVALID');
      }
      return this.cachePurge.purge(task.payload.paths);
    }
    if (task.type === 'OBJECT_DELETE_PUBLIC') {
      return this.publicMediaStorage.delete(requiredPayloadString(task, 'publicStorageKey'));
    }
    if (task.type === 'OBJECT_DELETE_PRIVATE') {
      return this.privateMediaStorage.delete(requiredPayloadString(task, 'privateStorageKey'));
    }
    throw new Error('OUTBOX_TYPE_UNSUPPORTED');
  }
}

module.exports = OutboxProcessor;
