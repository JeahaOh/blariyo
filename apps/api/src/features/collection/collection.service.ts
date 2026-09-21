import { IdempotencyRepository } from '../../shared/idempotency.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { collectionDigest, normalizeCollectionUrl } from './collection-url.js';
import { Inject, Injectable } from '@nestjs/common';
import { CollectionRepository } from './collection.repository.js';
import type { UpdateSource, CandidateSearch, CollectionCommand } from './collection.model.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { Storage } from '../../shared/storage.js';
import { fail, pagination, validId } from '../../shared/errors.js';
@Injectable()
export class CollectionService {
  constructor(
    @Inject(CollectionRepository) private readonly repository: CollectionRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(Storage) private readonly storage: Storage,
    @Inject(IdempotencyRepository) private readonly receipts: IdempotencyRepository,
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository
  ) {}
  async command(
    command: CollectionCommand,
    actor: string,
    key: string,
    scope: string
  ): Promise<{ status: number; data: unknown }> {
    const hash = collectionDigest({ params: command.params, body: command.body });
    return this.work.lock(
      `collect:key:${actor}:${scope}:${key}`,
      async () => {
        const previous = await this.receipts.find(actor, scope, key, true);
        if (previous) {
          if (!previous.hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
          return { status: previous.status, data: previous.data };
        }
        const run = () =>
          this.work.transaction(async () => {
            let resourceId: string;
            let status = 200;
            let data: unknown;
            if (command.action === 'create') {
              const created = await this.createCandidateInTransaction(
                command.body.originUrl,
                actor
              );
              resourceId = String(created.candidateId);
              status = 202;
              data = created;
            } else {
              const id = command.params.candidateId;
              if (!validId(id)) fail(404, 'CANDIDATE_NOT_FOUND');
              const candidate = await this.repository.find(id, true);
              if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
              if (candidate.lockVersion !== command.body.lockVersion)
                fail(409, 'CANDIDATE_VERSION_CONFLICT');
              if (
                command.action === 'retry'
                  ? candidate.status !== 'FETCH_FAILED'
                  : candidate.status !== 'NEW' && candidate.status !== 'FETCH_FAILED'
              )
                fail(409, 'CANDIDATE_STATE_CONFLICT');
              await this.discardPreviewsInTransaction(id, actor);
              if (command.action === 'retry') await this.repository.retryCandidate(id, actor);
              else await this.repository.rejectCandidate(id, command.body.reasonCode, actor);
              const updated = await this.repository.find(id);
              if (!updated) throw new Error('MISSING_UPDATED_CANDIDATE');
              resourceId = id;
              data = {
                candidateId: Number(id),
                status: updated.status,
                lockVersion: updated.lockVersion,
                reviewedAt: updated.reviewedAt?.toISOString() ?? null,
              };
            }
            await this.receipts.save(
              { actor, scope, key, hash, status, data, resourceType: 'CANDIDATE', resourceId },
              true
            );
            return { status, data };
          });
        try {
          return command.action === 'create'
            ? await run()
            : await this.work.lock(`collect:candidate:${command.params.candidateId}`, run);
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '23505' &&
            'constraint' in error &&
            typeof error.constraint === 'string' &&
            (error.constraint.includes('origin') || error.constraint.includes('source_post_key'))
          )
            fail(409, 'CANDIDATE_DUPLICATE');
          throw error;
        }
      },
      false
    );
  }
  async createCandidateInTransaction(originUrl: string, actor: string, discoveryMode: 'MANUAL_URL' | 'LIST_CRAWL' = 'MANUAL_URL') {
    const url = normalizeCollectionUrl(originUrl);
    const source = await this.repository.activeSourceByHost(new URL(url).hostname);
    if (!source) fail(403, 'SOURCE_NOT_ALLOWED');
    if (discoveryMode === 'LIST_CRAWL' && !(await this.repository.discoveryAllowed(source.id)))
      fail(403, 'SOURCE_NOT_ALLOWED');
    const hash = collectionDigest(url);
    if (await this.repository.originExists(hash)) fail(409, 'CANDIDATE_DUPLICATE');
    const duplicate = await this.repository.duplicatePost(url);
    try {
      const candidate = await this.repository.createCandidate(
        source.id,
        url,
        hash,
        duplicate,
        actor,
        discoveryMode
      );
      return {
        candidateId: Number(candidate.id),
        status: candidate.status,
        lockVersion: 1,
        duplicatePostId: duplicate === null ? null : Number(duplicate),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        typeof error.constraint === 'string' &&
        (error.constraint.includes('origin') || error.constraint.includes('source_post_key'))
      )
        fail(409, 'CANDIDATE_DUPLICATE');
      throw error;
    }
  }
  async discardPreviewsInTransaction(candidateId: string, actor: string) {
    for (const image of await this.repository.images(candidateId)) {
      if (image.previewStorageKey)
        await this.outbox.enqueue({
          type: 'OBJECT_DELETE_PRIVATE',
          aggregateType: 'STORAGE_OBJECT',
          aggregateId: null,
          payload: { privateStorageKey: image.previewStorageKey },
          actor,
        });
    }
    await this.repository.clearPreviews(candidateId, actor);
  }
  sources() {
    return this.repository.sources();
  }
  async updateSource(id: string, body: UpdateSource, actor: string) {
    if (!validId(id)) fail(404, 'SOURCE_NOT_FOUND');
    return this.work.transaction(async () => {
      const source = await this.repository.source(id, true);
      if (!source) fail(404, 'SOURCE_NOT_FOUND');
      if (source.lockVersion !== body.lockVersion) fail(409, 'SOURCE_VERSION_CONFLICT');
      if (
        (body.fetchMode && body.fetchMode !== 'URL_ONLY') ||
        (body.parserType && body.parserType !== 'MANUAL') ||
        body.listUrl ||
        body.isListCrawlEnabled
      )
        fail(409, 'SOURCE_STATE_CONFLICT');
      const changed = await this.repository.updateSource(
        id,
        source.lockVersion,
        {
          isActive: body.isActive ?? source.isActive,
          robotsAllowed: Object.hasOwn(body, 'robotsAllowed')
            ? (body.robotsAllowed ?? null)
            : source.robotsAllowed,
          robotsCheckedAt: Object.hasOwn(body, 'robotsAllowed')
            ? body.robotsAllowed === null
              ? null
              : new Date()
            : source.robotsCheckedAt,
          requestIntervalMs: body.requestIntervalMs ?? source.requestIntervalMs,
          dailyFetchLimit: body.dailyFetchLimit ?? source.dailyFetchLimit,
          disabledReasonCode: Object.hasOwn(body, 'isActive')
            ? body.isActive
              ? null
              : 'OPERATOR'
            : source.disabledReasonCode,
        },
        actor
      );
      if (!changed) fail(409, 'SOURCE_VERSION_CONFLICT');
      return changed;
    });
  }
  async search(query: CandidateSearch) {
    const result = await this.repository.search(query);
    return { items: result.items, meta: pagination(query.page, result.total, 50) };
  }
  async detail(id: string) {
    if (!validId(id)) fail(404, 'CANDIDATE_NOT_FOUND');
    const candidate = await this.repository.find(id);
    if (!candidate) fail(404, 'CANDIDATE_NOT_FOUND');
    return { candidate, images: await this.repository.images(id) };
  }
  async preview(candidateId: string, imageId: string) {
    if (!validId(candidateId) || !validId(imageId)) fail(404, 'IMAGE_NOT_FOUND');
    const image = await this.repository.livePreview(candidateId, imageId);
    if (!image?.previewStorageKey) fail(404, 'IMAGE_NOT_FOUND');
    try {
      const key = image.previewStorageKey;
      const mime = new Map([
        ['jpg', 'image/jpeg'],
        ['png', 'image/png'],
        ['gif', 'image/gif'],
        ['webp', 'image/webp'],
      ]).get(key.split('.').at(-1) ?? '');
      if (!mime) throw new Error('INVALID_PREVIEW_KEY');
      return { bytes: await this.storage.get('private', key), mime };
    } catch {
      fail(503, 'DEPENDENCY_UNAVAILABLE');
    }
  }
}
