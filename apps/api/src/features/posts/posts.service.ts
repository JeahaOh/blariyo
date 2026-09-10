import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PostsRepository } from './posts.repository.js';
import type {
  PostRecord,
  PostCommand,
  CreatePost,
  EditBlock,
  PostSearch,
  PostStatus,
  DuePost,
} from './posts.model.js';
import { ImagesRepository, type Image } from '../images/images.repository.js';
import { OutboxRepository } from '../../operations/outbox.repository.js';
import { IdempotencyRepository } from '../../shared/idempotency.repository.js';
import { Storage } from '../../shared/storage.js';
import { UnitOfWork } from '../../shared/unit-of-work.js';
import { fail, validId, validSlug, pagination } from '../../shared/errors.js';
import { canonical } from '../../shared/canonical.js';
export const POST_ORIGINS = Symbol('POST_ORIGINS');
export interface PostOrigins {
  siteOrigin: string;
  imageOrigin: string;
}
function errorProperty(error: unknown, key: string): string {
  if (typeof error === 'object' && error !== null && key in error) {
    const value: unknown = Reflect.get(error, key);
    if (typeof value === 'string') return value;
  }
  return '';
}
@Injectable()
export class PostsService {
  constructor(
    @Inject(PostsRepository) private readonly repository: PostsRepository,
    @Inject(ImagesRepository) private readonly images: ImagesRepository,
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(IdempotencyRepository) private readonly receipts: IdempotencyRepository,
    @Inject(Storage) private readonly storage: Storage,
    @Inject(UnitOfWork) private readonly work: UnitOfWork,
    @Inject(POST_ORIGINS) private readonly origins: PostOrigins
  ) {}
  private async find(postId: string, lock = false) {
    if (!validId(postId)) fail(404, 'POST_NOT_FOUND');
    const post = await this.repository.find(postId, lock);
    if (!post) fail(404, 'POST_NOT_FOUND');
    return post;
  }
  private async blocks(post: PostRecord, blocks: EditBlock[], actor: string) {
    const previous = await this.images.attached(post.id);
    if (
      post.status === 'HIDDEN_REVIEW' &&
      previous.some((image) => image.status === 'PUBLIC_DELETE_PENDING')
    )
      fail(409, 'IMAGE_STATE_CONFLICT');
    const ids = blocks
      .filter((block) => block.type === 'IMAGE')
      .map((block) => String(block.imageId));
    if (new Set(ids).size !== ids.length) fail(400, 'VALIDATION_FAILED');
    await this.repository.deleteBlocks(post.id);
    for (const image of previous.filter((image) => !ids.includes(image.id))) {
      const discarded = image.status === 'PRIVATE_REVIEW';
      await this.images.update(
        { ...image, postId: null, status: discarded ? 'PRIVATE_DELETE_PENDING' : 'STAGED' },
        actor
      );
      if (discarded) await this.deletePrivate(image, actor);
    }
    for (const [index, block] of blocks.entries()) {
      if (block.type === 'IMAGE') {
        const image = await this.images.find(String(block.imageId), true);
        if (!image) fail(409, 'IMAGE_STATE_CONFLICT');
        if (image.postId && image.postId !== post.id) fail(409, 'IMAGE_ALREADY_ATTACHED');
        if (!['STAGED', 'PRIVATE_REVIEW'].includes(image.status)) fail(409, 'IMAGE_STATE_CONFLICT');
        await this.images.update({ ...image, postId: post.id }, actor);
      }
      await this.repository.addBlock(post.id, index + 1, block, actor);
    }
  }
  private deletePrivate(image: Image, actor: string, delay = 0) {
    return this.outbox.enqueue({
      type: 'OBJECT_DELETE_PRIVATE',
      aggregateType: 'IMAGE',
      aggregateId: image.id,
      payload: { privateStorageKey: image.privateKey },
      actor,
      delay,
    });
  }
  private async createDraft(body: CreatePost, actor: string) {
    if (!validSlug(body.boardSlug)) fail(404, 'BOARD_NOT_FOUND');
    const board = await this.repository.postingBoard(body.boardSlug);
    if (!board) fail(404, 'BOARD_NOT_FOUND');
    const post = await this.repository.create(board.id, board.slug, body, actor);
    await this.blocks(post, body.blocks, actor);
    return post;
  }
  async createDraftInTransaction(body: CreatePost, actor: string) {
    const post = await this.createDraft(body, actor);
    await this.repository.history(post, null, 'CREATE', actor);
    return { postId: Number(post.id), status: 'DRAFT' as const, lockVersion: 1 };
  }
  private async replay(actor: string, scope: string, key: string, digest: Buffer) {
    const row = await this.receipts.find(actor, scope, key);
    if (row) {
      if (!row.hash.equals(digest)) fail(409, 'IDEMPOTENCY_CONFLICT');
      return { status: row.status, data: row.data };
    }
    return undefined;
  }
  async command(command: PostCommand, actor: string, key?: string, scope = '') {
    const run = () =>
      command.action === 'create'
        ? this.runCommand(command, actor, key, scope)
        : this.work.lock(`post-storage:${command.params.postId}`, () =>
            this.runCommand(command, actor, key, scope)
          );
    return key ? this.work.lock(`${actor}:${scope}:${key}`, run, false) : run();
  }
  private async runCommand(
    command: PostCommand,
    actor: string,
    key: string | undefined,
    scope: string
  ) {
    const digest = createHash('sha256')
      .update(JSON.stringify(canonical({ params: command.params, body: command.body })))
      .digest();
    if (key) {
      const saved = await this.replay(actor, scope, key, digest);
      if (saved) return saved;
    }
    const promoted: { image: Image; key: string }[] = [];
    try {
      if (
        command.action === 'republish' ||
        command.action === 'due' ||
        (command.action === 'publish' && command.body.mode === 'IMMEDIATE')
      ) {
        const post = await this.find(command.params.postId);
        if (post.lockVersion !== command.body.lockVersion) fail(409, 'POST_VERSION_CONFLICT');
        const allowed =
          command.action === 'republish'
            ? ['HIDDEN_REVIEW']
            : command.action === 'due'
              ? ['SCHEDULED']
              : ['DRAFT', 'SCHEDULED'];
        if (!allowed.includes(post.status)) fail(409, 'POST_STATE_CONFLICT');
        const attached = await this.images.attached(post.id);
        if (attached.some((image) => !['STAGED', 'PRIVATE_REVIEW'].includes(image.status)))
          fail(409, 'IMAGE_STATE_CONFLICT');
        for (const image of attached) {
          const ext = image.mime.split('/')[1]?.replace('jpeg', 'jpg');
          if (!ext) throw new Error('INVALID_IMAGE_MIME');
          const publicKey = `posts/${post.id}/${image.id}-${image.hash.toString('hex')}.${ext}`;
          promoted.push({ image, key: publicKey });
          try {
            await this.storage.promote(image.privateKey, publicKey);
          } catch {
            fail(503, 'DEPENDENCY_UNAVAILABLE');
          }
        }
      }
      return await this.work.transaction(async () => {
        if (key) {
          await this.work.transactionLock(`${actor}:${scope}:${key}`);
          const saved = await this.replay(actor, scope, key, digest);
          if (saved) return saved;
        }
        let post: PostRecord,
          previous: PostStatus | null = null,
          reason = command.action.toUpperCase(),
          publishNow = false;
        if (command.action === 'create') post = await this.createDraft(command.body, actor);
        else {
          post = await this.find(command.params.postId, true);
          previous = post.status;
          if (post.lockVersion !== command.body.lockVersion) fail(409, 'POST_VERSION_CONFLICT');
          const allowed: Record<Exclude<PostCommand['action'], 'create'>, string[]> = {
            update: ['DRAFT', 'SCHEDULED', 'HIDDEN_REVIEW'],
            publish:
              command.action === 'publish' && command.body.mode === 'IMMEDIATE'
                ? ['DRAFT', 'SCHEDULED']
                : ['DRAFT'],
            unschedule: ['SCHEDULED'],
            hide: ['PUBLISHED'],
            republish: ['HIDDEN_REVIEW'],
            remove: ['HIDDEN_REVIEW'],
            due: ['SCHEDULED'],
          };
          if (!allowed[command.action].includes(post.status)) fail(409, 'POST_STATE_CONFLICT');
          if (command.action === 'update') {
            const body = command.body;
            if (post.status === 'HIDDEN_REVIEW' && Object.hasOwn(body, 'pinnedPosition'))
              fail(400, 'VALIDATION_FAILED');
            if (body.blocks) await this.blocks(post, body.blocks, actor);
            if (body.title !== undefined) post.title = body.title.trim();
            if (Object.hasOwn(body, 'source')) {
              post.sourceName = body.source?.name.trim() || null;
              post.sourceUrl = body.source?.url || null;
            }
            if (body.pinnedPosition !== undefined) post.pinnedPosition = body.pinnedPosition;
            reason = 'EDIT';
          }
          if (command.action === 'publish' || command.action === 'due') {
            if (command.action === 'publish' && command.body.mode === 'SCHEDULED') {
              const at = command.body.scheduledAt;
              if (!at || new Date(at).getTime() < Date.now() + 60000)
                fail(400, 'VALIDATION_FAILED');
              post.status = 'SCHEDULED';
              post.scheduledAt = new Date(at);
              reason = 'SCHEDULE';
            } else {
              post.status = 'PUBLISHED';
              publishNow = true;
              post.scheduledAt = null;
              reason = command.action === 'due' ? 'SYSTEM_DUE' : 'PUBLISH';
            }
          }
          if (command.action === 'unschedule') {
            post.status = 'DRAFT';
            post.scheduledAt = null;
          }
          if (command.action === 'hide') {
            post.status = 'HIDDEN_REVIEW';
            post.pinnedPosition = null;
            reason = command.body.reasonCode;
            for (const image of await this.images.attached(post.id)) {
              if (image.status !== 'PUBLIC') fail(409, 'IMAGE_STATE_CONFLICT');
              await this.images.update({ ...image, status: 'PUBLIC_DELETE_PENDING' }, actor);
              await this.outbox.enqueue({
                type: 'OBJECT_DELETE_PUBLIC',
                aggregateType: 'IMAGE',
                aggregateId: image.id,
                payload: {
                  publicStorageKey: image.publicKey,
                  publicUrl: `${this.origins.imageOrigin}/${image.publicKey}`,
                },
                actor,
              });
            }
          }
          if (command.action === 'republish') {
            post.status = 'PUBLISHED';
            post.pinnedPosition = command.body.pinnedPosition;
          }
          if (command.action === 'remove') {
            const attached = await this.images.attached(post.id);
            if (attached.some((image) => image.status === 'PUBLIC_DELETE_PENDING'))
              fail(409, 'IMAGE_STATE_CONFLICT');
            post.status = 'REMOVED';
            for (const image of attached) {
              await this.images.update({ ...image, status: 'PRIVATE_DELETE_PENDING' }, actor);
              await this.deletePrivate(image, actor, 30 * 86400);
            }
          }
          post = await this.repository.update(post, actor, publishNow);
        }
        for (const { image, key: publicKey } of promoted) {
          const current = await this.images.find(image.id);
          if (current?.postId === post.id)
            await this.images.update({ ...current, status: 'PUBLIC', publicKey }, actor);
        }
        await this.repository.history(post, previous, reason, actor);
        if (
          ['PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED'].includes(post.status) &&
          command.action !== 'update'
        )
          await this.outbox.enqueue({
            type: 'CACHE_PURGE',
            aggregateType: 'POST',
            aggregateId: post.id,
            payload: {
              urls: [
                `${this.origins.siteOrigin}/${post.slug}`,
                `${this.origins.siteOrigin}/${post.slug}/posts/${post.id}`,
              ],
            },
            actor,
          });
        const data = {
          postId: Number(post.id),
          status: post.status,
          lockVersion: post.lockVersion,
          ...(command.action === 'create' ? {} : { updatedAt: post.updatedAt.toISOString() }),
          ...(['publish', 'unschedule'].includes(command.action)
            ? { scheduledAt: post.scheduledAt?.toISOString() ?? null }
            : {}),
          ...(command.action === 'publish'
            ? { publishedAt: post.publishedAt?.toISOString() ?? null }
            : {}),
        };
        const status = command.action === 'create' ? 201 : 200;
        if (key)
          await this.receipts.save({
            actor,
            scope,
            key,
            hash: digest,
            status,
            data,
            resourceType: 'POST',
            resourceId: post.id,
          });
        return { status, data };
      });
    } catch (error) {
      // A lost commit acknowledgement may follow a successful publication. The outbox rechecks ownership under the post lock.
      for (const { image, key: publicKey } of promoted)
        await this.outbox.enqueue({
          type: 'OBJECT_DELETE_PUBLIC',
          aggregateType: 'IMAGE',
          aggregateId: image.id,
          payload: {
            compensation: true,
            publicStorageKey: publicKey,
            publicUrl: `${this.origins.imageOrigin}/${publicKey}`,
          },
          actor,
        });
      if (errorProperty(error, 'constraint') === 'uq_board_post__active_pin')
        fail(409, 'PINNED_ORDER_CONFLICT');
      throw error;
    }
  }
  async search(query: PostSearch) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      fail(400, 'VALIDATION_FAILED');
    const result = await this.repository.search(query);
    return { items: result.items, meta: pagination(Number(query.page || 1), result.total, 50) };
  }
  async detail(postId: string) {
    const post = await this.find(postId);
    return { post, blocks: await this.repository.editorBlocks(post.id) };
  }
  private async scheduleFailure(post: DuePost, code: string) {
    const errorCode = /^[A-Z_]{1,80}$/.test(code) ? code : 'DEPENDENCY_UNAVAILABLE',
      attemptedAt = new Date();
    console.error(
      JSON.stringify({
        event: 'SCHEDULE_FAILED',
        postId: Number(post.id),
        scheduledAt: post.scheduledAt.toISOString(),
        errorCode,
        attemptedAt: attemptedAt.toISOString(),
      })
    );
    await this.repository.recordScheduleFailure(post, errorCode, attemptedAt);
  }
  async publishDue() {
    let done = 0;
    for (const post of await this.repository.due()) {
      try {
        await this.command(
          { action: 'due', params: { postId: post.id }, body: { lockVersion: post.lockVersion } },
          'system:scheduler'
        );
        done++;
      } catch (error) {
        const code = errorProperty(error, 'code');
        if (code === 'PINNED_ORDER_CONFLICT')
          await this.work.transaction(async () => {
            const changed = await this.repository.cancelConflictedSchedule(
              post.id,
              post.lockVersion
            );
            if (changed)
              await this.repository.history(
                changed,
                'SCHEDULED',
                'PINNED_ORDER_CONFLICT',
                'system:scheduler'
              );
          });
        if (!['POST_STATE_CONFLICT', 'POST_VERSION_CONFLICT'].includes(code))
          await this.scheduleFailure(post, code);
      }
    }
    return done;
  }
}
