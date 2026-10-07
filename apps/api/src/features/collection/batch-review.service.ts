import { CommonCodeRepository } from '../common-codes/common-code.repository.js';
import { COLLECTED_FILE_BYTES, COLLECTED_TOTAL_BYTES } from '../images/image-validation.js';
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { schemaValidator, normalizeInput } from '@blariyo/contracts';
import { draftTitle } from '@blariyo/contracts/draft-title';
import type { components } from '@blariyo/contracts/collection-api';
import { BatchReviewRepository, type Review, type BatchMedia } from './batch-review.repository.js';
import type { BatchResultRow } from './batch-result.repository.js';
import { CollectReader } from '../../shared/collect-reader.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { ImagesService } from '../images/images.service.js';
import { validateCollectedImage } from '../images/image-validation.js';
import { PostsService } from '../posts/posts.service.js';
import { originalDraftBlocks } from './collection-content.js';
import { collectionDigest, normalizeCollectionUrl } from './collection-url.js';
import { fail } from '../../shared/errors.js';
import { reviewManifest, reviewSelection } from './discord-review-policy.js';
import type { CreatePost } from '../posts/posts.model.js';
type BatchItem = components['schemas']['BatchItem'];
type BatchSummary = components['schemas']['BatchItemSummary'];
type ReviewBody = components['schemas']['BatchReviewRequest'];
type DraftBody = components['schemas']['BatchDraftRequest'];
type DeleteBody = components['schemas']['BatchDeleteRequest'];
function itemIs(value: unknown): value is BatchItem {
  return schemaValidator({ $ref: '#/components/schemas/BatchItem' })(value);
}
function summaryIs(value: unknown): value is BatchSummary {
  return schemaValidator({ $ref: '#/components/schemas/BatchItemSummary' })(value);
}
function url(value: string) { try { return new URL(value).href; } catch { fail(409, 'BATCH_CONTENT_INVALID'); } }
function snapshot(item: BatchResultRow, media: BatchMedia[]) {
  // Processing diagnostics are not part of the original-content review snapshot.
  const reviewedItem=Object.fromEntries(Object.entries(item).filter(([key])=>!['failure_code','skip_reason','fetched_at','collected_at','review_finalized_at','expires_at','retention_state','accessDeadline'].includes(key)));
  return collectionDigest({ item: reviewedItem, media: media.map(m => ({ ...m, hash: m.hash?.toString('hex') ?? null })) });
}
export interface PreparedBatchDraft {
  body: CreatePost;
  imageIds: number[];
  digest: string;
  checkDeadline: () => void;
}
function uniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
@Injectable()
export class BatchReviewService {
  constructor(
    @Inject(BatchReviewRepository) private readonly repository: BatchReviewRepository,
    @Inject(CollectReader) private readonly reader: CollectReader,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(ImagesService) private readonly images: ImagesService,
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(CommonCodeRepository) private readonly sourceCodes: CommonCodeRepository
  ) {}
  private async row(id: string) {
    const item = await this.repository.item(id);
    if (!item) fail(404, 'BATCH_ITEM_NOT_FOUND');
    return item;
  }
  private reviewDto(item: BatchResultRow, review: Review | null) {
    return review ? { status: review.status, lockVersion: review.lockVersion, itemVersion: review.itemVersion, postId: review.postId }
      : { status: 'UNREVIEWED' as const, lockVersion: 0, itemVersion: Number(item.version), postId: null };
  }
  private summary(item: BatchResultRow, review: Review | null): BatchSummary {
    if(performance.now()>=item.accessDeadline)fail(410,'BATCH_ITEM_EXPIRED');
    const value = { itemId: item.id, sourceKey: item.source_key, sourcePostKey: item.source_post_key,
      canonicalUrl: url(item.canonical_url), state: item.state, version: Number(item.version), title: item.title,
      failureCode: item.failure_code, skipReason: item.skip_reason,
      fetchedAt: item.state === 'FETCHED' ? item.fetched_at : null,
      retention: { collectedAt: item.collected_at, reviewFinalizedAt: item.review_finalized_at,
        expiresAt: item.expires_at, retentionState: item.retention_state },
      review: this.reviewDto(item, review) };
    if (!summaryIs(value)) fail(409, 'BATCH_CONTENT_INVALID');
    return value;
  }
  private dto(item: BatchResultRow, review: Review | null, media: BatchMedia[]): BatchItem {
    const value = { ...this.summary(item, review), contentDigest: snapshot(item, media).toString('hex'), bodyBlocks: normalizeInput(item.body_blocks ?? []),
      snsLinks: Array.isArray(item.sns_links) ? item.sns_links.map((value: unknown) => typeof value === 'string' ? url(value) : '') : [],
      attachments: normalizeInput(item.attachment_metadata), media: media.map(m => ({ mediaId: m.id, position: m.position,
        kind: m.kind, remoteUrl: m.remoteUrl ? url(m.remoteUrl) : null, mimeType: m.mime, byteSize: m.size })) };
    if (!itemIs(value)) fail(409, 'BATCH_CONTENT_INVALID');
    return value;
  }
  async detail(id: string) {
    return this.work.transaction(async () => {
      const item = await this.row(id);
      return { item: this.dto(item, await this.repository.review(id), await this.repository.media(id)) };
    }, { isolation: 'REPEATABLE READ', readOnly: true });
  }
  async deleteFailed(id: string, body: DeleteBody, actor: string, key: string) {
    const scope = `batch:delete:${id}`, hash = collectionDigest(body);
    return this.work.lock(`batch-command:${actor}:${scope}:${key}`, () => this.work.transaction(async () => {
      const receipt = await this.repository.receipt(actor, scope, key);
      if (receipt) {
        if (!receipt.hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
        return { status: receipt.status, data: receipt.data };
      }
      const result = await this.repository.deleteFailed(id, body.itemVersion, body.lockVersion, actor);
      if (result !== 'DELETED') {
        const status = result === 'BATCH_ITEM_NOT_FOUND' ? 404 : result === 'BATCH_ITEM_EXPIRED' ? 410 : result === 'VALIDATION_FAILED' ? 400 : 409;
        fail(status, result);
      }
      const data = { itemId: id, deleted: true, cleanupStatus: 'PENDING' };
      await this.repository.saveReceipt(actor, scope, key, hash, 200, data);
      return { status: 200, data };
    }));
  }
  private async mediaBytes(media: BatchMedia, deadline: number) {
    if (!media.key || !media.hash || !media.size || media.size > COLLECTED_FILE_BYTES) fail(409, 'BATCH_MEDIA_INCOMPLETE');
    let bytes: Buffer;
    const remaining=deadline-performance.now();
    if(remaining<=0)fail(410,'BATCH_ITEM_EXPIRED');
    const signal=AbortSignal.timeout(Math.min(30000,Math.ceil(remaining)));
    try { bytes = await this.reader.read(media.key, COLLECTED_FILE_BYTES,signal); }
    catch { if(performance.now()>=deadline)fail(410,'BATCH_ITEM_EXPIRED');fail(503, 'DEPENDENCY_UNAVAILABLE'); }
    if(performance.now()>=deadline)fail(410,'BATCH_ITEM_EXPIRED');
    if (bytes.length !== media.size || !createHash('sha256').update(bytes).digest().equals(media.hash)) fail(409, 'BATCH_MEDIA_CHECKSUM_MISMATCH');
    return bytes;
  }
  async preview(id: string, position: number) {
    const {media,item} = await this.work.transaction(async () => {
      const item=await this.row(id);
      const media = (await this.repository.media(id)).find(m => m.position === position && m.kind === 'IMAGE');
      if (!media) fail(404, 'BATCH_MEDIA_NOT_FOUND');
      return {media,item};
    }, { isolation: 'REPEATABLE READ', readOnly: true });
    const images = await validateCollectedImage(await this.mediaBytes(media,item.accessDeadline));
    await this.row(id);
    const image = images[0];
    if (!image) fail(415, 'UNSUPPORTED_MEDIA_TYPE');
    return { bytes: image.bytes, mime: image.mime, deadline: item.accessDeadline };
  }
  async list(page: number, source?: string, state?: string, reviewStatus?: string) {
    return this.work.transaction(async () => {
      const result = await this.repository.list(page, source, state, reviewStatus);
      const items=result.items.map(({item,review})=>this.summary(item,review));
      return { items, page, totalItems: result.total, totalPages: Math.max(1, Math.ceil(result.total / 20)) };
    }, { isolation: 'REPEATABLE READ', readOnly: true });
  }
  private async command(id: string, body: unknown, actor: string, key: string, operation: string,
    run: () => Promise<{ status: number; data: unknown }>) {
    const scope = `batch:${operation}:${id}`, hash = collectionDigest(body);
    return this.work.lock(`batch-request:${actor}:${scope}:${key}`, async () => {
      const item=await this.row(id);
      const receipt = await this.repository.receipt(actor, scope, key);
      if (receipt) {
        if (!receipt.hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
        if(performance.now()>=item.accessDeadline)fail(410,'BATCH_ITEM_EXPIRED');
        return { status: receipt.status, data: receipt.data };
      }
      return this.work.lock(`batch-review:${id}`, run);
    });
  }
  private async checked(id: string, itemVersion: number, lockVersion: number) {
    const item = await this.row(id), review = await this.repository.review(id);
    if (item.state !== 'FETCHED') fail(409, 'BATCH_ITEM_STATE_CONFLICT');
    if (Number(item.version) !== itemVersion) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
    if ((review?.lockVersion ?? 0) !== lockVersion) fail(409, 'BATCH_REVIEW_VERSION_CONFLICT');
    if (review?.postId != null) fail(409, 'BATCH_ALREADY_PROMOTED');
    const media = await this.repository.media(id);
    return { item, review, media, digest: snapshot(item, media) };
  }
  async commandSnapshot(id: string) {
    const item = await this.row(id), review = await this.repository.review(id), media = await this.repository.media(id);
    return { item, review, media, digest: snapshot(item, media) };
  }
  async review(id: string, body: ReviewBody, actor: string, key: string) {
    return this.command(id, body, actor, key, 'review', () => this.work.transaction(async () => {
      const { item, review, media, digest } = await this.checked(id, body.itemVersion, body.lockVersion);
      if (body.contentDigest !== digest.toString('hex')) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
      // Reject can record an invalid body; approval must be structurally reviewable.
      if (body.decision === 'APPROVED') this.dto(item, review, media);
      const updated = await this.repository.setReview(item, body.decision, body.lockVersion, actor,
        collectionDigest(normalizeCollectionUrl(item.canonical_url)), digest);
      const data = { review: this.reviewDto(item, updated) };
      await this.repository.saveReceipt(actor, `batch:review:${id}`, key, collectionDigest(body), 200, data);
      return { status: 200, data };
    }, { isolation: 'REPEATABLE READ' }));
  }
  /** Shared preparation for legacy admin drafts and durable review commands.
   * Call outside item/session locks when the command's epoch provides the final fence. */
  async prepareSelectedDraft(id: string, expectedDigest: string, boardSlug: string,
    selectedTitle: string | undefined, excludedUnitIds: string[], actor: string): Promise<PreparedBatchDraft> {
    const { item, media, detail } = await this.work.transaction(async () => {
      const item = await this.row(id), media = await this.repository.media(id);
      const detail = this.dto(item, await this.repository.review(id), media);
      if (item.state !== 'FETCHED' || detail.contentDigest !== expectedDigest) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
      return { item, media, detail };
    }, { isolation: 'REPEATABLE READ', readOnly: true });
    const originalPositions = detail.bodyBlocks.flatMap(b => b.type === 'IMAGE' ? [b.imagePosition] : []);
    const originalMedia = media.filter(m => m.kind === 'IMAGE');
    if (!detail.bodyBlocks.length || originalPositions.length !== originalMedia.length ||
      new Set(originalPositions).size !== originalPositions.length ||
      originalPositions.some(p => !originalMedia.some(m => m.position === p))) fail(409, 'BATCH_MEDIA_INCOMPLETE');
    const selection = reviewSelection(reviewManifest(detail.bodyBlocks, expectedDigest), excludedUnitIds);
    if (!selection.blocks.length) fail(409, 'BATCH_REVIEW_EMPTY_SELECTION');
    const positions = new Set(selection.blocks.flatMap(b => b.type === 'IMAGE' ? [b.imagePosition] : []));
    const retainedMedia = media.filter(m => m.kind !== 'IMAGE' || positions.has(m.position));
    const imageMedia = retainedMedia.filter(m => m.kind === 'IMAGE');
    if (retainedMedia.some(m => !m.size || m.size < 0 || m.size > COLLECTED_FILE_BYTES)) fail(409, 'BATCH_MEDIA_INCOMPLETE');
    if (retainedMedia.reduce((sum, m) => sum + (m.size ?? 0), 0) > COLLECTED_TOTAL_BYTES) fail(413, 'UPLOAD_TOO_LARGE');
    const draft = { boardSlug, title: draftTitle(selectedTitle ?? item.title ?? '', item.source_key),
      source: { name: (await this.sourceCodes.findReference('source', item.source_key))?.displayName ?? item.source_key,
        url: normalizeCollectionUrl(item.canonical_url) }, pinnedPosition: null };
    const preview = originalDraftBlocks(selection.blocks, (position, alt) => ({ type: 'IMAGE', imageId: position, alt: alt || '수집 이미지' }));
    if (!schemaValidator({ $ref: '#/components/schemas/CreatePostRequest' })({ ...draft, blocks: preview })) fail(400, 'VALIDATION_FAILED');
    const uploaded = new Map<number, number>(), imageIds: number[] = [];
    let remainingBytes = COLLECTED_TOTAL_BYTES;
    const deadline = performance.now() + 120000;
    const checkDeadline = () => { if (performance.now() >= deadline) fail(503, 'DEPENDENCY_UNAVAILABLE'); };
    try {
      for (const m of imageMedia) {
        checkDeadline();
        await this.row(id);
        const result = await this.images.uploadCollected(await this.mediaBytes(m, item.accessDeadline), actor, remainingBytes,
          { expiresAt: item.expires_at, deadline: item.accessDeadline }), image = result.items[0];
        if (!image) throw Error('MISSING_UPLOADED_IMAGE');
        remainingBytes -= image.byteSize;
        imageIds.push(image.imageId); uploaded.set(m.position, image.imageId);
        checkDeadline();
      }
      const blocks = originalDraftBlocks(selection.blocks, (position, alt) => {
        const imageId = uploaded.get(position); if (!imageId) fail(409, 'BATCH_MEDIA_INCOMPLETE');
        return { type: 'IMAGE', imageId, alt: alt || '수집 이미지' };
      });
      return { body: { ...draft, blocks }, imageIds, digest: expectedDigest, checkDeadline };
    } catch (error) {
      for (const imageId of imageIds) await this.images.discard(String(imageId), actor);
      throw error;
    }
  }
  async discardPrepared(prepared: PreparedBatchDraft, actor: string): Promise<void> {
    for (const imageId of prepared.imageIds) await this.images.discard(String(imageId), actor);
  }
  async promote(id: string, body: DraftBody, actor: string, key: string) {
    return this.command(id, body, actor, key, 'draft', async () => {
      const initial = await this.work.transaction(() => this.checked(id, body.itemVersion, body.lockVersion),
        { isolation: 'REPEATABLE READ', readOnly: true });
      const { item, review, digest } = initial;
      if (review?.status !== 'APPROVED') fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
      if (review.itemVersion !== body.itemVersion || !review.contentDigest.equals(digest)) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
      const canonical = normalizeCollectionUrl(item.canonical_url);
      return this.work.lock(`batch-source:${collectionDigest(canonical).toString('hex')}`, async () => {
        if (await this.repository.existingPost(canonical)) fail(409, 'BATCH_DUPLICATE_POST');
        let prepared: PreparedBatchDraft | undefined;
        try {
          prepared = await this.prepareSelectedDraft(id, digest.toString('hex'), body.boardSlug,
            body.title, [], actor);
          const ready = prepared;
          return await this.work.transaction(async () => {
            const current = await this.checked(id, body.itemVersion, body.lockVersion);
            if (current.review?.status !== 'APPROVED') fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
            if (!current.digest.equals(digest) || !current.review.contentDigest.equals(digest)) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
            ready.checkDeadline();
            const post = await this.posts.createDraftInTransaction(ready.body, actor);
            const updated = await this.repository.promote(id, body.lockVersion, post.postId, actor);
            const data = { itemId: id, ...post, reviewLockVersion: updated.lockVersion };
            await this.repository.saveReceipt(actor, `batch:draft:${id}`, key, collectionDigest(body), 201, data);
            return { status: 201, data };
          }, { isolation: 'REPEATABLE READ' });
        } catch (error) {
          // An ambiguous commit must never discard images already attached to a committed post.
          const committed = await this.repository.receipt(actor, `batch:draft:${id}`, key);
          if (committed) return { status: committed.status, data: committed.data };
          if (prepared) await this.discardPrepared(prepared, actor);
          if (uniqueConflict(error)) fail(409, 'BATCH_DUPLICATE_POST');
          throw error;
        }
      });
    });
  }
}
