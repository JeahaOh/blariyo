import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { ApiError, fail } from '../../shared/errors.js';
import { BatchReviewService, type PreparedBatchDraft } from './batch-review.service.js';
import { BatchReviewRepository } from './batch-review.repository.js';
import { ReviewCommandRepository, type AcceptReviewCommand, type ReviewCommandRecord } from './review-command.repository.js';
import { ReviewAuthority } from './review-authority.js';
import { collectionDigest, normalizeCollectionUrl } from './collection-url.js';
import { reviewManifest, reviewSelection } from './discord-review-policy.js';
import { DiscordCleanupDispatcher } from './discord-cleanup.js';
import { PostsService } from '../posts/posts.service.js';
import { PostsRepository } from '../posts/posts.repository.js';

@Injectable()
export class ReviewCommandService {
  constructor(@Inject(ReviewCommandRepository) private readonly commands: ReviewCommandRepository,
    @Inject(BatchReviewService) private readonly batches: BatchReviewService,
    @Inject(BatchReviewRepository) private readonly reviews: BatchReviewRepository,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(ReviewAuthority) private readonly authority: ReviewAuthority,
    @Inject(DiscordCleanupDispatcher) private readonly cleanup: DiscordCleanupDispatcher,
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(PostsRepository) private readonly postRepository: PostsRepository) {}

  private async cleanupAfterCommit(itemId: string) {
    for (const deliveryId of await this.commands.enqueueCleanup(itemId))
      this.work.afterCommit(() => this.cleanup.notify(deliveryId));
  }
  async replay(actor: string, key: string, hash: string) {
    this.authority.admin(actor);
    return this.commands.replay(actor,key,hash);
  }
  async accept(input: AcceptReviewCommand): Promise<ReviewCommandRecord> {
    return this.work.transaction(async () => {
      const accepted = await this.commands.accept(input);
      if (!accepted.created) return accepted.command;
      this.authority.assertCommand(accepted.command);
      const current = await this.batches.commandSnapshot(input.itemId);
      if (current.item.state !== 'FETCHED' || Number(current.item.version) !== input.itemVersion || current.digest.toString('hex') !== input.contentDigest)
        fail(409,'BATCH_ITEM_VERSION_CONFLICT');
      // Admin may preempt a Discord decision's review version, but not a changed original.
      // The authority epoch is already locked by accept(), so stale workers cannot commit.
      const reviewVersion = current.review?.lockVersion ?? 0;
      if (reviewVersion !== input.reviewVersion && !(input.origin === 'ADMIN' && input.reviewVersion < reviewVersion &&
        accepted.preemptedDiscordReviewVersion === reviewVersion)) fail(409,'BATCH_REVIEW_VERSION_CONFLICT');
      let linkedDraft: { id: number; version: number } | undefined;
      if (current.review?.postId !== null && current.review?.postId !== undefined) {
        const post = await this.postRepository.find(String(current.review.postId), true);
        if (!post || post.status !== 'DRAFT' || input.origin !== 'ADMIN') fail(409,'BATCH_ALREADY_PROMOTED');
        if (input.action === 'APPROVE_PUBLISH') {
          if (input.requestBody.postVersion !== post.lockVersion) fail(409,'POST_VERSION_CONFLICT');
          linkedDraft = { id: Number(post.id), version: post.lockVersion };
        }
      }
      if (input.action === 'APPROVE_PUBLISH') {
        const detail = (await this.batches.detail(input.itemId)).item;
        const selection = reviewSelection(reviewManifest(detail.bodyBlocks,input.contentDigest),input.excludedUnitIds);
        if (!selection.blocks.length) fail(409,'BATCH_REVIEW_EMPTY_SELECTION');
        if (selection.digest !== input.selectionDigest) fail(409,'BATCH_REVIEW_SELECTION_CONFLICT');
      }
      const updated = await this.reviews.setReview(current.item,input.action === 'REJECT' ? 'REJECTED' : 'APPROVED',
        current.review?.lockVersion ?? 0,input.actor,collectionDigest(normalizeCollectionUrl(current.item.canonical_url)),current.digest);
      const claimed = await this.commands.claim(accepted.command.id,'decision');
      if (!claimed?.leaseToken) fail(409,'BATCH_REVIEW_LEASE_LOST');
      let command = await this.commands.progress(claimed.id,claimed.epoch,claimed.leaseToken,'ACCEPTED',
        input.action === 'REJECT' ? 'REJECTED' : 'APPROVED',undefined,updated.lockVersion);
      if (linkedDraft) {
        const draftClaim = await this.commands.claim(command.id,'admin-draft');
        if (!draftClaim?.leaseToken) fail(409,'BATCH_REVIEW_LEASE_LOST');
        command = await this.commands.progress(command.id,command.epoch,draftClaim.leaseToken,'APPROVED','DRAFTED',linkedDraft,updated.lockVersion);
      }
      if (input.origin === 'ADMIN' || input.action === 'REJECT') await this.cleanupAfterCommit(input.itemId);
      return command;
    });
  }
  async advance(id: string, workerId: string): Promise<ReviewCommandRecord> {
    const claimed = await this.work.transaction(() => this.commands.claim(id,workerId));
    if (!claimed?.leaseToken) {
      const current = await this.commands.find(id);
      if (!current) fail(404,'BATCH_REVIEW_COMMAND_NOT_FOUND');
      return current;
    }
    const lease = claimed.leaseToken;
    let prepared: PreparedBatchDraft | undefined;
    try {
      this.authority.assertCommand(claimed);
      if (claimed.stage === 'APPROVED' || claimed.stage === 'PREPARING') {
        const boardSlug = claimed.requestBody.boardSlug, title = claimed.requestBody.title;
        if (typeof boardSlug !== 'string' || (title !== undefined && typeof title !== 'string')) fail(400,'VALIDATION_FAILED');
        prepared = await this.batches.prepareSelectedDraft(claimed.itemId,claimed.contentDigest,boardSlug,title,claimed.excludedUnitIds,claimed.actor);
        const ready = prepared;
        return await this.work.transaction(async () => {
          await this.commands.assertActive(id,claimed.epoch,lease);
          this.authority.assertCommand(claimed);
          const current = await this.batches.commandSnapshot(claimed.itemId);
          if (current.digest.toString('hex') !== claimed.contentDigest || current.review?.status !== 'APPROVED' ||
            current.review.lockVersion !== claimed.reviewVersion || current.review.postId !== null) fail(409,'BATCH_REVIEW_VERSION_CONFLICT');
          const canonical = normalizeCollectionUrl(current.item.canonical_url);
          await this.work.transactionLock(`batch-source:${collectionDigest(canonical).toString('hex')}`,true);
          if (await this.reviews.existingPost(canonical)) fail(409,'BATCH_DUPLICATE_POST');
          ready.checkDeadline();
          const post = await this.posts.createDraftInTransaction(ready.body,claimed.actor);
          const review = await this.reviews.promote(claimed.itemId,claimed.reviewVersion,post.postId,claimed.actor);
          return this.commands.progress(id,claimed.epoch,lease,claimed.stage,'DRAFTED',{ id: post.postId, version: post.lockVersion },review.lockVersion);
        });
      }
      if (claimed.stage === 'DRAFTED') {
        if (!claimed.postId || !claimed.postVersion) fail(409,'BATCH_REVIEW_STAGE_CONFLICT');
        const currentPost = await this.postRepository.find(String(claimed.postId));
        if (!currentPost) fail(404,'POST_NOT_FOUND');
        if (currentPost.status !== 'PUBLISHED') await this.posts.command({ action: 'publish',params: { postId: String(claimed.postId) },
          body: { lockVersion: claimed.postVersion,mode: 'IMMEDIATE' } },claimed.actor,`review-publish:${id}`,`review-publish:${id}`,
        { commandId: id,epoch: claimed.epoch,leaseToken: lease,authorize: () => this.authority.assertCommand(claimed) });
        return await this.work.transaction(async () => {
          await this.commands.assertActive(id,claimed.epoch,lease);
          const post = await this.postRepository.find(String(claimed.postId),true);
          if (!post || post.status !== 'PUBLISHED') fail(409,'POST_STATE_CONFLICT');
          const command = await this.commands.progress(id,claimed.epoch,lease,'DRAFTED','PUBLISHED',{ id: Number(post.id),version: post.lockVersion });
          await this.cleanupAfterCommit(claimed.itemId);
          return command;
        });
      }
      fail(409,'BATCH_REVIEW_STAGE_CONFLICT');
    } catch (error) {
      // A lost commit acknowledgement must not discard images linked by that commit.
      const current = await this.commands.find(id);
      if (current && ['DRAFTED','PUBLISHED'].includes(current.stage) && current.postId && claimed.stage !== 'DRAFTED') return current;
      if (prepared) await this.batches.discardPrepared(prepared,claimed.actor);
      if (current?.finished) return current;
      const code = error instanceof ApiError ? error.code : 'DEPENDENCY_UNAVAILABLE';
      try {
        await this.work.transaction(async () => {
          if (error instanceof ApiError && [400,403,404,409,410,413,415].includes(error.status))
            await this.commands.progress(id,claimed.epoch,lease,claimed.stage,'NEEDS_ADMIN',undefined,undefined,code);
          else await this.commands.retry(id,claimed.epoch,lease,code);
        });
      } catch (lost) {
        if (!(lost instanceof ApiError && ['BATCH_REVIEW_SUPERSEDED','BATCH_REVIEW_LEASE_LOST'].includes(lost.code))) throw lost;
      }
      const after = await this.commands.find(id);
      if (!after) throw error;
      return after;
    }
  }
}
