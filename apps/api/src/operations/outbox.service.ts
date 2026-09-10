import { Inject, Injectable } from '@nestjs/common';
import { OutboxRepository, type OutboxTask } from './outbox.repository.js';
import { ImagesRepository } from '../features/images/images.repository.js';
import { Storage, EdgeCache } from '../shared/storage.js';
import { UnitOfWork } from '../shared/unit-of-work.js';
function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string') throw new Error('INVALID_OUTBOX_PAYLOAD');
  return value;
}
function urls(payload: Record<string, unknown>): string[] {
  const value = payload.urls;
  if (!Array.isArray(value) || !value.every((item: unknown) => typeof item === 'string'))
    throw new Error('INVALID_OUTBOX_URLS');
  return value;
}
@Injectable()
export class OutboxService {
  private readonly actor = 'system:outbox-worker';
  constructor(
    @Inject(OutboxRepository) private readonly repository: OutboxRepository,
    @Inject(ImagesRepository) private readonly images: ImagesRepository,
    @Inject(Storage) private readonly storage: Storage,
    @Inject(EdgeCache) private readonly cache: EdgeCache,
    @Inject(UnitOfWork) private readonly work: UnitOfWork
  ) {}
  async run(limit = 100) {
    await this.repository.recoverExpired(this.actor);
    let processed = 0;
    while (processed < limit) {
      const task = await this.work.transaction(() => this.repository.claim(this.actor));
      if (!task) break;
      processed++;
      try {
        const image =
          task.aggregateType === 'IMAGE' && task.aggregateId
            ? await this.images.find(task.aggregateId)
            : null;
        const key =
          typeof task.payload.publicStorageKey === 'string' ? task.payload.publicStorageKey : '';
        const postId = image?.postId || /^posts\/(\d+)\//.exec(key)?.[1];
        if (postId) await this.work.lock(`post-storage:${postId}`, () => this.execute(task));
        else await this.execute(task);
      } catch {
        await this.repository.fail(task);
      }
    }
    return processed;
  }
  private async execute(task: OutboxTask) {
    if (!(await this.repository.owns(task))) return;
    let deleteObject = true;
    if (task.type === 'OBJECT_DELETE_PUBLIC') {
      const image = await this.images.byPublicKey(text(task.payload, 'publicStorageKey'));
      deleteObject =
        task.aggregateType === 'IMAGE' && !task.payload.compensation
          ? image?.status === 'PUBLIC_DELETE_PENDING' && image.id === task.aggregateId
          : image?.status !== 'PUBLIC';
    }
    if (task.type === 'CACHE_PURGE') await this.cache.purge(urls(task.payload));
    if (task.type === 'OBJECT_DELETE_PUBLIC' && deleteObject) {
      await this.storage.delete('public', text(task.payload, 'publicStorageKey'));
      await this.cache.purge([text(task.payload, 'publicUrl')]);
    }
    if (task.type === 'OBJECT_DELETE_PRIVATE')
      await this.storage.delete('private', text(task.payload, 'privateStorageKey'));
    await this.work.transaction(async () => {
      if (!(await this.repository.owns(task, true))) return;
      if (task.aggregateType === 'IMAGE' && task.aggregateId) {
        if (task.type === 'OBJECT_DELETE_PUBLIC' && !task.payload.compensation)
          await this.images.transitionStatus(
            task.aggregateId,
            'PUBLIC_DELETE_PENDING',
            'PRIVATE_REVIEW',
            this.actor,
            true
          );
        if (task.type === 'OBJECT_DELETE_PRIVATE')
          await this.images.transitionStatus(
            task.aggregateId,
            'PRIVATE_DELETE_PENDING',
            'DELETED',
            this.actor
          );
      }
      await this.repository.succeed(task.id);
    });
  }
}
