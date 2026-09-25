import { collectionPostKey } from '../features/collection/collection-url.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  CollectCandidateEntity,
  CollectCandidateImageEntity,
  CollectSourceEntity,
  ContentBoardPostEntity,
  ContentBoardPostImageEntity,
} from './entities.js';
import { DatabaseContext } from './database.js';
import { requiredRow, rows } from './rows.js';
import { CollectionRepository } from '../features/collection/collection.repository.js';
import type {
  SourceRecord,
  CandidateResultMetadata,
  SourceChange,
  CandidateRecord,
  CandidateImage,
  CandidateSearch,
} from '../features/collection/collection.model.js';

function mapSource(row: CollectSourceEntity): SourceRecord {
  if (
    row.fetch_mode !== 'URL_ONLY' ||
    row.parser_type !== 'MANUAL' ||
    row.list_url !== null ||
    row.is_list_crawl_enabled !== false
  )
    throw new Error('INVALID_SOURCE_STATE');
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    host: row.host,
    fetchMode: row.fetch_mode,
    parserType: row.parser_type,
    listUrl: row.list_url,
    isListCrawlEnabled: row.is_list_crawl_enabled,
    isActive: row.is_active,
    robotsAllowed: row.robots_allowed,
    robotsCheckedAt: row.robots_checked_at,
    requestIntervalMs: row.request_interval_ms,
    dailyFetchLimit: row.daily_fetch_limit,
    lastFetchedAt: row.last_fetched_at,
    lastErrorCode: row.last_error_code,
    disabledReasonCode: row.disabled_reason_code,
    lockVersion: row.lock_version,
    updatedAt: row.updated_at,
    nextRequestAt: row.next_request_at,
    consecutiveErrorCount: row.consecutive_error_count,
  };
}
function mapCandidate(
  row: CollectCandidateEntity,
  extra: Record<string, unknown> | undefined
): CandidateRecord {
  const state = row.status;
  if (
    state !== 'PENDING' &&
    state !== 'RUNNING' &&
    state !== 'NEW' &&
    state !== 'FETCH_FAILED' &&
    state !== 'APPROVED' &&
    state !== 'REJECTED'
  )
    throw new Error('INVALID_CANDIDATE_STATE');
  if (
    (row.discovery_mode !== 'MANUAL_URL' && row.discovery_mode !== 'LIST_CRAWL') ||
    !Array.isArray(row.warnings) ||
    !row.warnings.every((item: unknown): item is string => typeof item === 'string')
  )
    throw new Error('INVALID_CANDIDATE_METADATA');
  if (
    typeof extra?.source_name !== 'string' ||
    typeof extra.image_count !== 'string' ||
    !/^\d+$/.test(extra.image_count)
  )
    throw new Error('INVALID_CANDIDATE_SUMMARY');
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: extra.source_name,
    imageCount: Number(extra.image_count),
    originUrl: row.origin_url,
    originUrlSha256: row.origin_url_sha256,
    title: row.title,
    status: state,
    discoveryMode: row.discovery_mode,
    duplicatePostId: row.duplicate_post_id,
    postId: row.post_id,
    rejectReasonCode: row.reject_reason_code,
    fetchErrorCode: row.fetch_error_code,
    requestedAt: row.requested_at,
    claimedAt: row.claimed_at,
    fetchedAt: row.fetched_at,
    reviewedAt: row.reviewed_at,
    lockVersion: row.lock_version,
    collectorId: row.collector_id,
    collectorExecutionId: row.collector_execution_id,
    leaseUntil: row.lease_until,
    attemptCount: row.attempt_count,
    warnings: row.warnings,
    parserVersion: row.parser_version,
    sourcePublishedAt: row.source_published_at,
    resultPayloadSha256: row.result_payload_sha256,
    contentBlocks: row.content_blocks,
    lastHeartbeatAt: row.last_heartbeat_at,
  };
}
function mapImage(row: CollectCandidateImageEntity): CandidateImage {
  const status = row.status;
  if (status !== 'DISCOVERED' && status !== 'STORED' && status !== 'SKIPPED' && status !== 'FAILED')
    throw new Error('INVALID_CANDIDATE_IMAGE_STATE');
  return {
    id: row.id,
    candidateId: row.candidate_id,
    position: row.position,
    remoteUrl: row.remote_url,
    status,
    imageId: row.image_id,
    previewStorageKey: row.preview_storage_key,
    previewExpiresAt: row.preview_expires_at,
    fetchErrorCode: row.fetch_error_code,
    previewSourceSha256: row.preview_source_sha256,
    previewUploadedAt: row.preview_uploaded_at,
  };
}
@Injectable()
export class TypeOrmCollectionRepository extends CollectionRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext) {
    super();
  }
  async activeSourceByHost(host: string) {
    const row = await this.db.manager.findOneBy(CollectSourceEntity, { host, is_active: true });
    return row ? mapSource(row) : null;
  }
  originExists(hash: Buffer, excludingId?: string) {
    const query = this.db.manager
      .createQueryBuilder(CollectCandidateEntity, 'c')
      .where('c.origin_url_sha256=:hash', { hash });
    if (excludingId !== undefined) query.andWhere('c.id<>:excludingId', { excludingId });
    return query.getExists();
  }
  async duplicatePost(url: string, hashes: Buffer[] = [], imageIds: string[] = []) {
    const candidates = [...hashes];
    if (imageIds.length) {
      const uploaded = await this.db.manager
        .createQueryBuilder(ContentBoardPostImageEntity, 'i')
        .where('i.id = ANY(:imageIds::bigint[])', { imageIds })
        .getMany();
      candidates.push(...uploaded.map((image) => image.content_sha256));
    }
    const post = await this.db.manager
      .createQueryBuilder(ContentBoardPostEntity, 'p')
      .select('p.id')
      .where('p.source_url = :url', { url })
      .orWhere(
        'EXISTS(SELECT 1 FROM content.board_post_image i WHERE i.post_id=p.id AND i.content_sha256=ANY(:hashes::bytea[]))',
        { hashes: candidates }
      )
      .orderBy('p.id', 'ASC')
      .limit(1)
      .getOne();
    return post?.id ?? null;
  }
  async discoveryAllowed(sourceId: string) {
    const result = rows(
      await this.db.manager.query(
        'SELECT enabled FROM collect.source_discovery_policy WHERE source_id=$1',
        [sourceId]
      )
    );
    return result[0]?.enabled === true;
  }
  async createCandidate(
    sourceId: string,
    url: string,
    hash: Buffer,
    duplicatePostId: string | null,
    actor: string,
    discoveryMode: 'MANUAL_URL' | 'LIST_CRAWL' = 'MANUAL_URL'
  ) {
    const repository = this.db.manager.getRepository(CollectCandidateEntity);
    const row = await repository.save(
      repository.create({
        source_id: sourceId,
        origin_url: url,
        origin_url_sha256: hash,
        source_post_key: collectionPostKey(url),
        discovery_mode: discoveryMode,
        status: 'PENDING',
        duplicate_post_id: duplicatePostId,
        created_by: actor,
        updated_by: actor,
      })
    );
    const candidate = await this.find(row.id);
    if (!candidate) throw new Error('MISSING_CREATED_CANDIDATE');
    return candidate;
  }
  async replaceResult(candidateId: string, metadata: CandidateResultMetadata, actor: string) {
    await this.db.manager.delete(CollectCandidateImageEntity, { candidate_id: candidateId });
    if (metadata.images.length)
      await this.db.manager.insert(
        CollectCandidateImageEntity,
        metadata.images.map((image) => ({
          candidate_id: candidateId,
          position: image.position,
          remote_url: image.remoteUrl,
          created_by: actor,
          updated_by: actor,
        }))
      );
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        title: metadata.title,
        content_blocks: metadata.contentBlocks,
        origin_url: metadata.url,
        origin_url_sha256: metadata.hash,
        parser_version: metadata.parserVersion,
        source_published_at: metadata.sourcePublishedAt,
        duplicate_post_id: metadata.duplicatePostId,
      })
      .where('id=:candidateId', { candidateId })
      .execute();
  }
  async finishResult(
    candidateId: string,
    status: 'NEW' | 'FETCH_FAILED',
    errorCode: string | null,
    warnings: string[],
    actor: string,
    resultDigest?: Buffer
  ) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        status,
        fetch_error_code: errorCode,
        warnings: () => ':warnings::jsonb',
        lease_until: null,
        fetched_at: () => 'now()',
        lock_version: () => 'lock_version+1',
        updated_by: actor,
        updated_at: () => 'now()',
        ...(resultDigest === undefined ? {} : { result_payload_sha256: resultDigest }),
      })
      .where('id=:candidateId', { candidateId })
      .setParameter('warnings', JSON.stringify(warnings))
      .execute();
  }
  async recordSourceFetch(sourceId: string, errorCode: string | null, actor: string) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectSourceEntity)
      .set({
        last_fetched_at: () => 'now()',
        last_error_code: errorCode,
        consecutive_error_count: () => (errorCode === null ? '0' : 'consecutive_error_count+1'),
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id=:sourceId', { sourceId })
      .execute();
  }
  async storePreview(imageId: string, key: string, sourceHash?: Buffer) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateImageEntity)
      .set({
        preview_storage_key: key,
        preview_expires_at: () => "now()+interval '24 hours'",
        updated_by: 'system:collector',
        updated_at: () => 'now()',
        ...(sourceHash === undefined
          ? {}
          : { preview_source_sha256: sourceHash, preview_uploaded_at: () => 'now()' }),
      })
      .where('id=:imageId', { imageId })
      .returning(['preview_expires_at'])
      .execute();
    const row = requiredRow(result.raw);
    if (!(row.preview_expires_at instanceof Date)) throw new Error('INVALID_PREVIEW_EXPIRY');
    return row.preview_expires_at;
  }
  async markPreviewUploaded(candidateId: string, duplicatePostId: string | null) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        duplicate_post_id: () => 'COALESCE(:duplicatePostId,duplicate_post_id)',
        lock_version: () => 'lock_version+1',
        updated_by: 'system:collector',
        updated_at: () => 'now()',
      })
      .where('id=:candidateId', { candidateId })
      .setParameter('duplicatePostId', duplicatePostId)
      .execute();
  }
  previewReferenced(key: string) {
    return this.db.manager.existsBy(CollectCandidateImageEntity, { preview_storage_key: key });
  }
  async approve(
    candidateId: string,
    postId: string,
    images: { candidateImageId: string; imageId: string }[],
    actor: string
  ) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateImageEntity)
      .set({ status: 'SKIPPED', updated_by: actor, updated_at: () => 'now()' })
      .where('candidate_id = :candidateId', { candidateId })
      .execute();
    for (const image of images) {
      const changed = await this.db.manager
        .createQueryBuilder()
        .update(CollectCandidateImageEntity)
        .set({ status: 'STORED', image_id: image.imageId })
        .where('id = :id AND candidate_id = :candidateId', {
          id: image.candidateImageId,
          candidateId,
        })
        .execute();
      if (changed.affected !== 1) throw new Error('MISSING_PROMOTED_CANDIDATE_IMAGE');
    }
    const changed = await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        status: 'APPROVED',
        post_id: postId,
        reviewed_at: () => 'now()',
        lock_version: () => 'lock_version+1',
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id = :candidateId', { candidateId })
      .execute();
    if (changed.affected !== 1) throw new Error('MISSING_PROMOTED_CANDIDATE');
  }
  async clearPreviews(candidateId: string, actor: string) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateImageEntity)
      .set({
        preview_storage_key: null,
        preview_expires_at: null,
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('candidate_id = :candidateId', { candidateId })
      .execute();
  }
  async retryCandidate(candidateId: string, actor: string) {
    await this.db.manager.delete(CollectCandidateImageEntity, { candidate_id: candidateId });
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        status: 'PENDING',
        content_blocks: null,
        requested_at: () => 'now()',
        fetched_at: null,
        fetch_error_code: null,
        lease_until: null,
        collector_id: null,
        claimed_at: null,
        attempt_count: 0,
        title: null,
        parser_version: null,
        warnings: () => "'[]'::jsonb",
        lock_version: () => 'lock_version+1',
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id = :candidateId', { candidateId })
      .execute();
  }
  async rejectCandidate(candidateId: string, reason: string, actor: string) {
    await this.db.manager
      .createQueryBuilder()
      .update(CollectCandidateEntity)
      .set({
        status: 'REJECTED',
        content_blocks: null,
        reject_reason_code: reason,
        reviewed_at: () => 'now()',
        lock_version: () => 'lock_version+1',
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id = :candidateId', { candidateId })
      .execute();
  }
  async sourcesByIds(ids: string[]) {
    if (!ids.length) return [];
    return (
      await this.db.manager
        .createQueryBuilder(CollectSourceEntity, 's')
        .where('s.id = ANY(:ids::bigint[])', { ids })
        .getMany()
    ).map(mapSource);
  }
  async sources() {
    return (await this.db.manager.find(CollectSourceEntity, { order: { id: 'ASC' } })).map(
      mapSource
    );
  }
  async source(id: string, lock = false) {
    const query = this.db.manager
      .createQueryBuilder(CollectSourceEntity, 's')
      .where('s.id = :id', { id });
    if (lock) query.setLock('pessimistic_write');
    const row = await query.getOne();
    return row ? mapSource(row) : null;
  }
  async updateSource(id: string, version: number, change: SourceChange, actor: string) {
    const result = await this.db.manager
      .createQueryBuilder()
      .update(CollectSourceEntity)
      .set({
        is_active: change.isActive,
        robots_allowed: change.robotsAllowed,
        robots_checked_at: change.robotsCheckedAt,
        request_interval_ms: change.requestIntervalMs,
        daily_fetch_limit: change.dailyFetchLimit,
        disabled_reason_code: change.disabledReasonCode,
        lock_version: () => 'lock_version+1',
        updated_by: actor,
        updated_at: () => 'now()',
      })
      .where('id = :id AND lock_version = :version', { id, version })
      .execute();
    return result.affected === 1 ? this.source(id) : null;
  }
  private candidates() {
    return this.db.manager
      .createQueryBuilder(CollectCandidateEntity, 'c')
      .innerJoin(CollectSourceEntity, 's', 's.id = c.source_id')
      .addSelect('s.name', 'source_name')
      .addSelect(
        (query) =>
          query
            .select('count(*)')
            .from(CollectCandidateImageEntity, 'image')
            .where('image.candidate_id = c.id'),
        'image_count'
      );
  }
  async find(id: string, lock = false) {
    const query = this.candidates().where('c.id = :id', { id });
    if (lock) query.setLock('pessimistic_write', undefined, ['c']);
    const result = await query.getRawAndEntities();
    const row = result.entities[0];
    return row ? mapCandidate(row, rows(result.raw)[0]) : null;
  }
  async search(input: CandidateSearch) {
    const query = this.candidates();
    if (input.status) query.andWhere('c.status = :status', { status: input.status });
    if (input.sourceId) query.andWhere('c.source_id = :sourceId', { sourceId: input.sourceId });
    if (input.discoveryMode)
      query.andWhere('c.discovery_mode = :discoveryMode', { discoveryMode: input.discoveryMode });
    if (input.duplicateOnly) query.andWhere('c.duplicate_post_id IS NOT NULL');
    const total = await query.getCount();
    const result = await query
      .orderBy('COALESCE(c.fetched_at,c.requested_at)', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .limit(50)
      .offset((input.page - 1) * 50)
      .getRawAndEntities();
    const extras = rows(result.raw);
    return { items: result.entities.map((row, index) => mapCandidate(row, extras[index])), total };
  }
  async images(candidateId: string) {
    return (
      await this.db.manager.find(CollectCandidateImageEntity, {
        where: { candidate_id: candidateId },
        order: { position: 'ASC' },
      })
    ).map(mapImage);
  }
  async livePreview(candidateId: string, imageId: string) {
    const row = await this.db.manager
      .createQueryBuilder(CollectCandidateImageEntity, 'i')
      .innerJoin(CollectCandidateEntity, 'c', 'c.id = i.candidate_id')
      .where(
        "c.id = :candidateId AND i.id = :imageId AND c.status = 'NEW' AND i.preview_expires_at > now()",
        { candidateId, imageId }
      )
      .getOne();
    return row ? mapImage(row) : null;
  }
}
