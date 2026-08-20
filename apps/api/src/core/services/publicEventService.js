const crypto = require('crypto');
const AppError = require('../errors/appError');

const EVENT_FIELDS = Object.freeze({
  FEED_VIEW: { required: ['listPage', 'itemCount'], forbidden: ['postId'] },
  POST_VIEW: { required: ['postId'], forbidden: ['listPage', 'itemCount'] },
  DETAIL_LIST_VIEW: { required: ['postId', 'listPage', 'itemCount'], forbidden: [] },
});
const COMMON_FIELDS = ['eventType', 'anonymousId', 'sessionId', 'boardSlug', 'occurredAt'];
const BOARD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function validationError(field, reason) {
  return new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ field, reason }]);
}

function positiveInteger(value, max) {
  return Number.isSafeInteger(value) && value >= 1 && value <= max;
}

class PublicEventService {
  constructor({ boardRepository, postRepository, eventRepository, eventHmacSecret, clock = () => new Date() }) {
    if (typeof eventHmacSecret !== 'string' || Buffer.byteLength(eventHmacSecret) < 32) {
      throw new Error('EVENT_HMAC_SECRET must be at least 32 bytes');
    }
    this.boardRepository = boardRepository;
    this.postRepository = postRepository;
    this.eventRepository = eventRepository;
    this.eventHmacSecret = eventHmacSecret;
    this.clock = clock;
  }

  hmac(value) {
    return crypto.createHmac('sha256', this.eventHmacSecret).update(value).digest();
  }

  validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw validationError('body', 'objectRequired');
    }
    const definition = EVENT_FIELDS[payload.eventType];
    if (!definition) throw validationError('eventType', 'unsupportedValue');

    const allowed = new Set([...COMMON_FIELDS, ...definition.required]);
    for (const field of Object.keys(payload)) {
      if (!allowed.has(field)) throw validationError(field, 'notAllowed');
    }
    for (const field of [...COMMON_FIELDS, ...definition.required]) {
      if (payload[field] === undefined || payload[field] === null) {
        throw validationError(field, 'required');
      }
    }
    for (const field of definition.forbidden) {
      if (payload[field] !== undefined) throw validationError(field, 'notAllowed');
    }
    for (const field of ['anonymousId', 'sessionId']) {
      const value = payload[field];
      if (typeof value !== 'string' || value.length < 16 || value.length > 128 || !ID_PATTERN.test(value)) {
        throw validationError(field, 'invalidFormat');
      }
    }
    if (
      typeof payload.boardSlug !== 'string'
      || payload.boardSlug.length > 32
      || !BOARD_SLUG_PATTERN.test(payload.boardSlug)
    ) {
      throw validationError('boardSlug', 'invalidFormat');
    }
    if (payload.postId !== undefined && !positiveInteger(payload.postId, Number.MAX_SAFE_INTEGER)) {
      throw validationError('postId', 'integerRange');
    }
    if (payload.listPage !== undefined && !positiveInteger(payload.listPage, 10000)) {
      throw validationError('listPage', 'integerRange');
    }
    if (
      payload.itemCount !== undefined
      && (!Number.isInteger(payload.itemCount) || payload.itemCount < 0 || payload.itemCount > 20)
    ) {
      throw validationError('itemCount', 'integerRange');
    }
    if (
      typeof payload.occurredAt !== 'string'
      || payload.occurredAt.length > 40
      || !DATE_TIME_PATTERN.test(payload.occurredAt)
    ) {
      throw validationError('occurredAt', 'dateTime');
    }
    const occurredAt = new Date(payload.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw validationError('occurredAt', 'dateTime');

    return { ...payload, occurredAt };
  }

  async ingest(payload) {
    const event = this.validate(payload);
    const board = await this.boardRepository.findActiveBoardBySlug(event.boardSlug);
    if (!board) {
      throw new AppError(404, 'BOARD_NOT_FOUND', '게시판을 찾을 수 없습니다.');
    }
    if (event.postId !== undefined) {
      const post = await this.postRepository.findPublicPost(event.boardSlug, event.postId);
      if (!post) throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }

    const receivedAt = this.clock();
    const futureLimit = receivedAt.getTime() + 10 * 60 * 1000;
    const pastLimit = receivedAt.getTime() - 24 * 60 * 60 * 1000;
    const occurredAt = event.occurredAt.getTime() > futureLimit || event.occurredAt.getTime() < pastLimit
      ? receivedAt
      : event.occurredAt;
    const anonymousHmac = this.hmac(`anonymous:${event.anonymousId}`);
    const sessionHmac = this.hmac(`session:${event.sessionId}`);
    const bucket = Math.floor(receivedAt.getTime() / 10000);
    const dedupeHmac = this.hmac(JSON.stringify([
      sessionHmac.toString('hex'),
      event.eventType,
      String(board.id),
      event.postId ?? null,
      event.listPage ?? null,
      event.itemCount ?? null,
      bucket,
    ]));

    await this.eventRepository.insertRawEvent({
      type: event.eventType,
      anonymousHmac,
      sessionHmac,
      boardId: board.id,
      postId: event.postId ?? null,
      listPage: event.listPage ?? null,
      itemCount: event.itemCount ?? null,
      dedupeHmac,
      occurredAt,
    });
  }
}

module.exports = PublicEventService;
