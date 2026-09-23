import { COLLECTED_FILE_BYTES, COLLECTED_TOTAL_BYTES } from '../images/image-validation.js';
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { schemaValidator, normalizeInput } from '@blariyo/contracts';
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
type BatchItem = components['schemas']['BatchItem'];
type BatchSummary = components['schemas']['BatchItemSummary'];
type ReviewBody = components['schemas']['BatchReviewRequest'];
type DraftBody = components['schemas']['BatchDraftRequest'];
function itemIs(value: unknown): value is BatchItem {
  return schemaValidator({ $ref: '#/components/schemas/BatchItem' })(value);
}
function summaryIs(value: unknown): value is BatchSummary {
  return schemaValidator({ $ref: '#/components/schemas/BatchItemSummary' })(value);
}
function url(value: string) { try { return new URL(value).href; } catch { fail(409, 'BATCH_CONTENT_INVALID'); } }
function snapshot(item: BatchResultRow, media: BatchMedia[]) {
  // Processing diagnostics are not part of the original-content review snapshot.
  const reviewedItem=Object.fromEntries(Object.entries(item).filter(([key])=>!['failure_code','skip_reason'].includes(key)));
  return collectionDigest({ item: reviewedItem, media: media.map(m => ({ ...m, hash: m.hash?.toString('hex') ?? null })) });
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
    @Inject(PostsService) private readonly posts: PostsService
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
    const value = { itemId: item.id, sourceKey: item.source_key, sourcePostKey: item.source_post_key,
      canonicalUrl: url(item.canonical_url), state: item.state, version: Number(item.version), title: item.title,
      failureCode: item.failure_code, skipReason: item.skip_reason,
      review: this.reviewDto(item, review) };
    if (!summaryIs(value)) fail(409, 'BATCH_CONTENT_INVALID');
    return value;
  }
  private dto(item: BatchResultRow, review: Review | null, media: BatchMedia[]): BatchItem {
    const value = { ...this.summary(item, review), bodyBlocks: normalizeInput(item.body_blocks ?? []),
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
  private async mediaBytes(media: BatchMedia) {
    if (!media.key || !media.hash || !media.size || media.size > COLLECTED_FILE_BYTES) fail(409, 'BATCH_MEDIA_INCOMPLETE');
    let bytes: Buffer;
    try { bytes = await this.reader.read(media.key, COLLECTED_FILE_BYTES); } catch { fail(503, 'DEPENDENCY_UNAVAILABLE'); }
    if (bytes.length !== media.size || !createHash('sha256').update(bytes).digest().equals(media.hash)) fail(409, 'BATCH_MEDIA_CHECKSUM_MISMATCH');
    return bytes;
  }
  async preview(id: string, position: number) {
    const media = await this.work.transaction(async () => {
      await this.row(id);
      const media = (await this.repository.media(id)).find(m => m.position === position && m.kind === 'IMAGE');
      if (!media) fail(404, 'BATCH_MEDIA_NOT_FOUND');
      return media;
    }, { isolation: 'REPEATABLE READ', readOnly: true });
    const images = await validateCollectedImage(await this.mediaBytes(media));
    const image = images[0];
    if (!image) fail(415, 'UNSUPPORTED_MEDIA_TYPE');
    return { bytes: image.bytes, mime: image.mime };
  }
  async list(page: number, source?: string, state?: string, reviewStatus?: string) {
    return this.work.transaction(async () => {
      const result = await this.repository.list(page, source, state, reviewStatus), items = [];
      for (const row of result.items) items.push(this.summary(row, await this.repository.review(row.id)));
      return { items, page, totalItems: result.total, totalPages: Math.max(1, Math.ceil(result.total / 20)) };
    }, { isolation: 'REPEATABLE READ', readOnly: true });
  }
  private async command(id: string, body: unknown, actor: string, key: string, operation: string,
    run: () => Promise<{ status: number; data: unknown }>) {
    const scope = `batch:${operation}:${id}`, hash = collectionDigest(body);
    return this.work.lock(`batch-request:${actor}:${scope}:${key}`, async () => {
      const receipt = await this.repository.receipt(actor, scope, key);
      if (receipt) {
        if (!receipt.hash.equals(hash)) fail(409, 'IDEMPOTENCY_CONFLICT');
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
  async review(id: string, body: ReviewBody, actor: string, key: string) {
    return this.command(id, body, actor, key, 'review', () => this.work.transaction(async () => {
      const { item, review, media, digest } = await this.checked(id, body.itemVersion, body.lockVersion);
      if (body.decision === 'REVIEWING') {
        if (review?.status === 'REVIEWING' && review.contentDigest.equals(digest)) fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
      } else {
        if (review?.status !== 'REVIEWING') fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
        if (review.itemVersion !== body.itemVersion || !review.contentDigest.equals(digest)) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
      }
      // Reject can record an invalid body; approval must be structurally reviewable.
      if (body.decision === 'APPROVED') this.dto(item, review, media);
      const updated = await this.repository.setReview(item, body.decision, body.lockVersion, actor,
        collectionDigest(normalizeCollectionUrl(item.canonical_url)), digest);
      const data = { review: this.reviewDto(item, updated) };
      await this.repository.saveReceipt(actor, `batch:review:${id}`, key, collectionDigest(body), 200, data);
      return { status: 200, data };
    }, { isolation: 'REPEATABLE READ' }));
  }
  async promote(id: string, body: DraftBody, actor: string, key: string) {
    return this.command(id, body, actor, key, 'draft', async () => {
      const initial = await this.work.transaction(() => this.checked(id, body.itemVersion, body.lockVersion),
        { isolation: 'REPEATABLE READ', readOnly: true });
      const { item, review, media, digest } = initial;
      if (review?.status !== 'APPROVED') fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
      if (review.itemVersion !== body.itemVersion || !review.contentDigest.equals(digest)) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
      const canonical = normalizeCollectionUrl(item.canonical_url);
      return this.work.lock(`batch-source:${collectionDigest(canonical).toString('hex')}`, async () => {
        if (await this.repository.existingPost(canonical)) fail(409, 'BATCH_DUPLICATE_POST');
        const detail = this.dto(item, review, media), prepared: number[] = [];
        const positions = detail.bodyBlocks.flatMap(b => b.type === 'IMAGE' ? [b.imagePosition] : []);
        const imageMedia = media.filter(m => m.kind === 'IMAGE');
        if (!detail.bodyBlocks.length || positions.length !== imageMedia.length || new Set(positions).size !== positions.length ||
          positions.some(p => !imageMedia.some(m => m.position === p))) fail(409, 'BATCH_MEDIA_INCOMPLETE');
        if (media.some(m => !m.size || m.size < 0 || m.size > COLLECTED_FILE_BYTES)) fail(409, 'BATCH_MEDIA_INCOMPLETE');
        if (media.reduce((sum, m) => sum + (m.size ?? 0), 0) > COLLECTED_TOTAL_BYTES) fail(413, 'UPLOAD_TOO_LARGE');
        const title = (body.title ?? item.title ?? '').trim();
        const draft = { boardSlug: body.boardSlug, title, source: { name: item.source_key, url: canonical }, pinnedPosition: null };
        // Validate before any object writes; placeholder positive IDs preserve the actual block shape.
        const previewBlocks = originalDraftBlocks(detail.bodyBlocks, (position, alt) => ({ type: 'IMAGE', imageId: position, alt: alt || '수집 이미지' }));
        if (!schemaValidator({ $ref: '#/components/schemas/CreatePostRequest' })({ ...draft, blocks: previewBlocks })) fail(400, 'VALIDATION_FAILED');
        const uploaded = new Map<number, number>();
        let remainingBytes = COLLECTED_TOTAL_BYTES;
        const deadline = performance.now() + 120000;
        const checkDeadline = () => {
          if (performance.now() >= deadline) fail(503, 'DEPENDENCY_UNAVAILABLE');
        };
        try {
          for (const m of imageMedia) {
            checkDeadline();
            const result = await this.images.uploadCollected(await this.mediaBytes(m), actor, remainingBytes), image = result.items[0];
            if (!image) throw Error('MISSING_UPLOADED_IMAGE');
            remainingBytes -= image.byteSize;
            prepared.push(image.imageId); uploaded.set(m.position, image.imageId);
            checkDeadline();
          }
          return await this.work.transaction(async () => {
            const current = await this.checked(id, body.itemVersion, body.lockVersion);
            if (current.review?.status !== 'APPROVED') fail(409, 'BATCH_REVIEW_STATE_CONFLICT');
            if (!current.digest.equals(digest) || !current.review.contentDigest.equals(digest)) fail(409, 'BATCH_ITEM_VERSION_CONFLICT');
            const blocks = originalDraftBlocks(detail.bodyBlocks, (position, alt) => {
              const imageId = uploaded.get(position); if (!imageId) fail(409, 'BATCH_MEDIA_INCOMPLETE');
              return { type: 'IMAGE', imageId, alt: alt || '수집 이미지' };
            });
            checkDeadline();
            const post = await this.posts.createDraftInTransaction({ ...draft, blocks }, actor);
            const updated = await this.repository.promote(id, body.lockVersion, post.postId, actor);
            const data = { itemId: id, ...post, reviewLockVersion: updated.lockVersion };
            await this.repository.saveReceipt(actor, `batch:draft:${id}`, key, collectionDigest(body), 201, data);
            return { status: 201, data };
          }, { isolation: 'REPEATABLE READ' });
        } catch (error) {
          // An ambiguous commit must never discard images already attached to a committed post.
          const committed = await this.repository.receipt(actor, `batch:draft:${id}`, key);
          if (committed) return { status: committed.status, data: committed.data };
          for (const imageId of prepared) await this.images.discard(String(imageId), actor);
          if (uniqueConflict(error)) fail(409, 'BATCH_DUPLICATE_POST');
          throw error;
        }
      });
    });
  }
}
