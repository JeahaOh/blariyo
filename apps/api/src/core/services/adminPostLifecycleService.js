const crypto = require('crypto');
const AppError = require('../errors/appError');

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function validation(field, reason) {
  return new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ field, reason }]);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(value, allowed) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw validation(field, 'notAllowed');
  }
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw validation(field, 'positiveInteger');
  return value;
}

function parsePostId(rawPostId) {
  if (typeof rawPostId !== 'string' || !/^[1-9][0-9]*$/.test(rawPostId)) return null;
  const postId = Number(rawPostId);
  return Number.isSafeInteger(postId) ? postId : null;
}

function mapRepositoryError(kind) {
  const errors = {
    POST_NOT_FOUND: [404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.'],
    POST_STATE_CONFLICT: [409, 'POST_STATE_CONFLICT', '현재 게시글 상태에서는 처리할 수 없습니다.'],
    POST_VERSION_CONFLICT: [409, 'POST_VERSION_CONFLICT', '게시글이 다른 요청에 의해 변경되었습니다.'],
    PINNED_ORDER_CONFLICT: [409, 'PINNED_ORDER_CONFLICT', '이미 사용 중인 공지 순서입니다.'],
    IMAGE_STATE_CONFLICT: [409, 'IMAGE_STATE_CONFLICT', '현재 이미지 상태에서는 처리할 수 없습니다.'],
  };
  const mapped = errors[kind];
  if (!mapped) throw new Error(`Unknown repository result: ${kind}`);
  throw new AppError(...mapped);
}

class AdminPostLifecycleService {
  constructor({ adminPostLifecycleRepository, mediaPromotionService, clock = () => new Date() }) {
    this.repository = adminPostLifecycleRepository;
    this.mediaPromotionService = mediaPromotionService;
    this.clock = clock;
  }

  normalizePublish(rawBody, now) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    exactFields(rawBody, new Set(['lockVersion', 'mode', 'scheduledAt']));
    const lockVersion = positiveInteger(rawBody.lockVersion, 'lockVersion');
    if (rawBody.mode === 'IMMEDIATE') {
      if (rawBody.scheduledAt !== undefined) throw validation('scheduledAt', 'notAllowed');
      return { lockVersion, mode: 'IMMEDIATE' };
    }
    if (rawBody.mode !== 'SCHEDULED') throw validation('mode', 'unsupportedValue');
    if (typeof rawBody.scheduledAt !== 'string'
      || !DATE_TIME_PATTERN.test(rawBody.scheduledAt)
      || Number.isNaN(Date.parse(rawBody.scheduledAt))) {
      throw validation('scheduledAt', 'dateTime');
    }
    const scheduledAt = new Date(rawBody.scheduledAt);
    if (scheduledAt.getTime() < now.getTime() + 60_000) {
      throw validation('scheduledAt', 'minimumLeadTime');
    }
    return { lockVersion, mode: 'SCHEDULED', scheduledAt };
  }

  normalizeUnschedule(rawBody) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    exactFields(rawBody, new Set(['lockVersion']));
    return { lockVersion: positiveInteger(rawBody.lockVersion, 'lockVersion') };
  }

  normalizeHide(rawBody) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    exactFields(rawBody, new Set(['lockVersion', 'reasonCode']));
    const lockVersion = positiveInteger(rawBody.lockVersion, 'lockVersion');
    if (rawBody.reasonCode !== 'RIGHTS_EMAIL') throw validation('reasonCode', 'unsupportedValue');
    return { lockVersion, reasonCode: rawBody.reasonCode };
  }

  normalizeRepublish(rawBody) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    exactFields(rawBody, new Set(['lockVersion', 'pinnedPosition']));
    const lockVersion = positiveInteger(rawBody.lockVersion, 'lockVersion');
    if (!Object.prototype.hasOwnProperty.call(rawBody, 'pinnedPosition')) {
      throw validation('pinnedPosition', 'required');
    }
    if (rawBody.pinnedPosition !== null
      && (!Number.isInteger(rawBody.pinnedPosition)
        || rawBody.pinnedPosition < 1
        || rawBody.pinnedPosition > 3)) {
      throw validation('pinnedPosition', 'integerRange');
    }
    return { lockVersion, pinnedPosition: rawBody.pinnedPosition };
  }

  normalizeRemove(rawBody) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    exactFields(rawBody, new Set(['lockVersion', 'reasonCode']));
    const lockVersion = positiveInteger(rawBody.lockVersion, 'lockVersion');
    if (rawBody.reasonCode !== 'RIGHTS_EMAIL') throw validation('reasonCode', 'unsupportedValue');
    return { lockVersion, reasonCode: rawBody.reasonCode };
  }

  async publish(rawPostId, rawBody, actor, idempotencyKey) {
    const postId = this.requirePostId(rawPostId);
    const now = this.clock();
    const command = this.normalizePublish(rawBody, now);
    const meta = this.meta(actor, `POST /internal/v1/admin/posts/:postId/publish`, idempotencyKey, command);
    const result = await this.repository.runIdempotent(meta, async (client) => {
      const prepared = await this.repository.preparePublish(client, postId, command.lockVersion);
      if (prepared.kind !== 'READY') return prepared;
      if (command.mode === 'SCHEDULED') {
        if (prepared.post.status !== 'DRAFT') return { kind: 'POST_STATE_CONFLICT' };
        return this.repository.schedule(client, prepared, command, meta, now);
      }
      let promoted;
      try {
        promoted = await this.mediaPromotionService.promote(postId, prepared.images);
      } catch {
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', '일시적으로 서비스를 이용할 수 없습니다.');
      }
      return this.repository.publish(client, prepared, promoted, meta, now);
    });
    return this.unwrap(result, meta.requestHash);
  }

  async unschedule(rawPostId, rawBody, actor, idempotencyKey) {
    const postId = this.requirePostId(rawPostId);
    const command = this.normalizeUnschedule(rawBody);
    const meta = this.meta(actor, 'POST /internal/v1/admin/posts/:postId/unschedule', idempotencyKey, command);
    const result = await this.repository.runIdempotent(meta, (client) =>
      this.repository.unschedule(client, postId, command, meta, this.clock())
    );
    return this.unwrap(result, meta.requestHash);
  }

  async hide(rawPostId, rawBody, actor, idempotencyKey) {
    const postId = this.requirePostId(rawPostId);
    const command = this.normalizeHide(rawBody);
    const meta = this.meta(actor, 'POST /internal/v1/admin/posts/:postId/hide', idempotencyKey, command);
    const result = await this.repository.runIdempotent(meta, (client) =>
      this.repository.hide(client, postId, command, meta, this.clock())
    );
    return this.unwrap(result, meta.requestHash);
  }

  async republish(rawPostId, rawBody, actor, idempotencyKey) {
    const postId = this.requirePostId(rawPostId);
    const command = this.normalizeRepublish(rawBody);
    const meta = this.meta(actor, 'POST /internal/v1/admin/posts/:postId/republish', idempotencyKey, command);
    const result = await this.repository.runIdempotent(meta, async (client) => {
      const prepared = await this.repository.prepareRepublish(client, postId, command.lockVersion);
      if (prepared.kind !== 'READY') return prepared;
      let promoted;
      try {
        promoted = await this.mediaPromotionService.promote(postId, prepared.images);
      } catch {
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', '일시적으로 서비스를 이용할 수 없습니다.');
      }
      return this.repository.republish(client, prepared, promoted, command, meta, this.clock());
    });
    return this.unwrap(result, meta.requestHash);
  }

  async remove(rawPostId, rawBody, actor, idempotencyKey) {
    const postId = this.requirePostId(rawPostId);
    const command = this.normalizeRemove(rawBody);
    const meta = this.meta(actor, 'DELETE /internal/v1/admin/posts/:postId', idempotencyKey, command);
    const result = await this.repository.runIdempotent(meta, (client) =>
      this.repository.remove(client, postId, command, meta, this.clock())
    );
    return this.unwrap(result, meta.requestHash);
  }

  requirePostId(rawPostId) {
    const postId = parsePostId(rawPostId);
    if (postId === null) throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    return postId;
  }

  meta(actor, scope, idempotencyKey, command) {
    if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw validation('Idempotency-Key', 'requiredOrInvalid');
    }
    const serializable = command.scheduledAt
      ? { ...command, scheduledAt: command.scheduledAt.toISOString() }
      : command;
    return {
      actor,
      scope,
      idempotencyKey,
      requestHash: crypto.createHash('sha256').update(JSON.stringify(serializable)).digest(),
    };
  }

  unwrap(result, requestHash) {
    if (result.kind === 'COMPLETED') return result.responseBody;
    if (result.kind === 'IDEMPOTENCY_IN_PROGRESS') {
      throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', '같은 멱등 요청을 처리 중입니다.');
    }
    if (result.kind === 'IDEMPOTENT') {
      if (!Buffer.isBuffer(result.row.request_hash)
        || result.row.request_hash.length !== requestHash.length
        || !crypto.timingSafeEqual(result.row.request_hash, requestHash)) {
        throw new AppError(409, 'IDEMPOTENCY_CONFLICT', '같은 멱등키가 다른 요청에 사용되었습니다.');
      }
      return result.row.response_body;
    }
    return mapRepositoryError(result.kind);
  }
}

module.exports = AdminPostLifecycleService;
