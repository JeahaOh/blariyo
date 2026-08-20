const crypto = require('crypto');
const AppError = require('../errors/appError');

const CREATE_FIELDS = new Set(['boardSlug', 'title', 'source', 'blocks', 'pinnedPosition']);
const UPDATE_FIELDS = new Set(['lockVersion', 'title', 'source', 'blocks', 'pinnedPosition']);
const BOARD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;
const MAX_BLOCKS = 40;
const MAX_IMAGES = 20;

function validation(field, reason) {
  return new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ field, reason }]);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownFields(value, allowed, prefix = '') {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw validation(prefix ? `${prefix}.${field}` : field, 'notAllowed');
  }
}

function requiredTrimmedString(value, field, maxLength) {
  if (typeof value !== 'string') throw validation(field, 'required');
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) throw validation(field, 'length');
  return trimmed;
}

function normalizeSource(value) {
  if (value === null) return null;
  if (!isObject(value)) throw validation('source', 'objectOrNull');
  rejectUnknownFields(value, new Set(['name', 'url']), 'source');
  const name = requiredTrimmedString(value.name, 'source.name', 200);
  const url = requiredTrimmedString(value.url, 'source.url', 2048);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw validation('source.url', 'httpsUrl');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw validation('source.url', 'httpsUrl');
  }
  return { name, url: parsed.toString() };
}

function normalizePinnedPosition(value, field = 'pinnedPosition') {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 3) throw validation(field, 'integerRange');
  return value;
}

function normalizeBlocks(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BLOCKS) {
    throw validation('blocks', 'arrayLength');
  }
  const imageIds = [];
  const blocks = value.map((rawBlock, index) => {
    const field = `blocks[${index}]`;
    if (!isObject(rawBlock)) throw validation(field, 'object');
    if (rawBlock.type === 'TEXT') {
      rejectUnknownFields(rawBlock, new Set(['type', 'text']), field);
      if (typeof rawBlock.text !== 'string') throw validation(`${field}.text`, 'required');
      if (rawBlock.text.trim().length < 1 || rawBlock.text.length > 20000) {
        throw validation(`${field}.text`, 'length');
      }
      return { type: 'TEXT', text: rawBlock.text };
    }
    if (rawBlock.type === 'IMAGE') {
      rejectUnknownFields(rawBlock, new Set(['type', 'imageId', 'alt']), field);
      if (!Number.isSafeInteger(rawBlock.imageId) || rawBlock.imageId < 1) {
        throw validation(`${field}.imageId`, 'positiveInteger');
      }
      const alt = requiredTrimmedString(rawBlock.alt, `${field}.alt`, 300);
      imageIds.push(rawBlock.imageId);
      return { type: 'IMAGE', imageId: rawBlock.imageId, alt };
    }
    throw validation(`${field}.type`, 'unsupportedValue');
  });
  if (imageIds.length > MAX_IMAGES) throw validation('blocks', 'tooManyImages');
  if (new Set(imageIds).size !== imageIds.length) throw validation('blocks', 'duplicateImage');
  return { blocks, imageIds };
}

function parsePostId(rawPostId) {
  if (typeof rawPostId !== 'string' || !/^[1-9][0-9]*$/.test(rawPostId)) return null;
  const postId = Number(rawPostId);
  return Number.isSafeInteger(postId) ? postId : null;
}

function mapRepositoryError(kind) {
  const errors = {
    BOARD_NOT_FOUND: [404, 'BOARD_NOT_FOUND', '게시판을 찾을 수 없습니다.'],
    POST_NOT_FOUND: [404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.'],
    POST_STATE_CONFLICT: [409, 'POST_STATE_CONFLICT', '현재 게시글 상태에서는 처리할 수 없습니다.'],
    POST_VERSION_CONFLICT: [409, 'POST_VERSION_CONFLICT', '게시글이 다른 요청에 의해 변경되었습니다.'],
    PINNED_ORDER_CONFLICT: [409, 'PINNED_ORDER_CONFLICT', '이미 사용 중인 공지 순서입니다.'],
    IMAGE_NOT_FOUND: [404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.'],
    IMAGE_ALREADY_ATTACHED: [409, 'IMAGE_ALREADY_ATTACHED', '이미 다른 게시글에 연결된 이미지입니다.'],
    IMAGE_STATE_CONFLICT: [409, 'IMAGE_STATE_CONFLICT', '현재 이미지 상태에서는 처리할 수 없습니다.'],
  };
  const mapped = errors[kind];
  if (!mapped) throw new Error(`Unknown repository result: ${kind}`);
  throw new AppError(...mapped);
}

class AdminPostCommandService {
  constructor({ adminPostCommandRepository }) {
    this.adminPostCommandRepository = adminPostCommandRepository;
  }

  normalizeCreate(rawBody) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    rejectUnknownFields(rawBody, CREATE_FIELDS);
    if (typeof rawBody.boardSlug !== 'string'
      || rawBody.boardSlug.length > 32
      || !BOARD_SLUG_PATTERN.test(rawBody.boardSlug)) {
      throw validation('boardSlug', 'invalidFormat');
    }
    const normalizedBlocks = normalizeBlocks(rawBody.blocks);
    return {
      boardSlug: rawBody.boardSlug,
      title: requiredTrimmedString(rawBody.title, 'title', 200),
      source: rawBody.source === undefined ? null : normalizeSource(rawBody.source),
      blocks: normalizedBlocks.blocks,
      imageIds: normalizedBlocks.imageIds,
      pinnedPosition: rawBody.pinnedPosition === undefined
        ? null
        : normalizePinnedPosition(rawBody.pinnedPosition),
    };
  }

  normalizeUpdate(rawBody) {
    if (!isObject(rawBody)) throw validation('body', 'object');
    rejectUnknownFields(rawBody, UPDATE_FIELDS);
    if (!Number.isInteger(rawBody.lockVersion) || rawBody.lockVersion < 1) {
      throw validation('lockVersion', 'positiveInteger');
    }
    if (Object.keys(rawBody).length === 1) throw validation('body', 'noChanges');
    const command = { lockVersion: rawBody.lockVersion };
    if (rawBody.title !== undefined) command.title = requiredTrimmedString(rawBody.title, 'title', 200);
    if (rawBody.source !== undefined) command.source = normalizeSource(rawBody.source);
    if (rawBody.pinnedPosition !== undefined) {
      command.pinnedPosition = normalizePinnedPosition(rawBody.pinnedPosition);
    }
    if (rawBody.blocks !== undefined) {
      const normalizedBlocks = normalizeBlocks(rawBody.blocks);
      command.blocks = normalizedBlocks.blocks;
      command.imageIds = normalizedBlocks.imageIds;
    }
    return command;
  }

  async create(rawBody, actor, idempotencyKey) {
    if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw validation('Idempotency-Key', 'requiredOrInvalid');
    }
    const command = this.normalizeCreate(rawBody);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(command)).digest();
    const result = await this.adminPostCommandRepository.createDraft(command, {
      actor,
      scope: 'POST /internal/v1/admin/posts',
      idempotencyKey,
      requestHash,
    });
    if (result.kind === 'CREATED') return result.responseBody;
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

  async update(rawPostId, rawBody, actor) {
    const postId = parsePostId(rawPostId);
    if (postId === null) throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    const command = this.normalizeUpdate(rawBody);
    const result = await this.adminPostCommandRepository.updateDraft(postId, command, actor);
    if (result.kind !== 'UPDATED') return mapRepositoryError(result.kind);
    return {
      postId: Number(result.row.id),
      status: result.row.status,
      lockVersion: result.row.lock_version,
      updatedAt: result.row.updated_at instanceof Date
        ? result.row.updated_at.toISOString()
        : new Date(result.row.updated_at).toISOString(),
    };
  }
}

module.exports = AdminPostCommandService;
module.exports.normalizeBlocks = normalizeBlocks;
