const AppError = require('../errors/appError');

const PAGE_SIZE = 50;
const POST_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED']);
const BOARD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const SEARCH_FIELDS = new Set(['status', 'board', 'titlePrefix', 'from', 'to', 'page']);

function validation(field, reason) {
  return new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ field, reason }]);
}

function toSafeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} exceeds the JSON safe integer range`);
  }
  return number;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optionalIsoString(value) {
  return value === null ? null : toIsoString(value);
}

function escapeLikePrefix(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

class AdminPostService {
  constructor({ adminPostRepository }) {
    this.adminPostRepository = adminPostRepository;
  }

  parseSearch(rawQuery) {
    for (const field of Object.keys(rawQuery)) {
      if (!SEARCH_FIELDS.has(field)) throw validation(field, 'notAllowed');
      if (typeof rawQuery[field] !== 'string') throw validation(field, 'singleValueRequired');
    }

    const filters = {};
    if (rawQuery.status !== undefined) {
      if (!POST_STATUSES.has(rawQuery.status)) throw validation('status', 'unsupportedValue');
      filters.status = rawQuery.status;
    }
    if (rawQuery.board !== undefined) {
      if (rawQuery.board.length > 32 || !BOARD_SLUG_PATTERN.test(rawQuery.board)) {
        throw validation('board', 'invalidFormat');
      }
      filters.board = rawQuery.board;
    }
    if (rawQuery.titlePrefix !== undefined) {
      const value = rawQuery.titlePrefix.trim();
      if (value.length < 1 || value.length > 100) throw validation('titlePrefix', 'length');
      filters.titlePrefix = escapeLikePrefix(value);
    }
    for (const field of ['from', 'to']) {
      const value = rawQuery[field];
      if (value !== undefined) {
        if (!DATE_TIME_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
          throw validation(field, 'dateTime');
        }
        filters[field] = new Date(value);
      }
    }
    if (filters.from && filters.to && filters.from > filters.to) {
      throw validation('to', 'beforeFrom');
    }

    let page = 1;
    if (rawQuery.page !== undefined) {
      if (!POSITIVE_INTEGER_PATTERN.test(rawQuery.page)) throw validation('page', 'integerRange');
      page = Number(rawQuery.page);
      if (!Number.isSafeInteger(page) || page > 10000) throw validation('page', 'integerRange');
    }
    return { filters, page };
  }

  parsePostId(rawPostId) {
    if (typeof rawPostId !== 'string' || !POSITIVE_INTEGER_PATTERN.test(rawPostId)) return null;
    const postId = Number(rawPostId);
    return Number.isSafeInteger(postId) ? postId : null;
  }

  async searchPosts(rawQuery) {
    const { filters, page } = this.parseSearch(rawQuery);
    const totalItems = await this.adminPostRepository.countPosts(filters);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / PAGE_SIZE);
    const rows = await this.adminPostRepository.findPosts(filters, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    return {
      data: {
        items: rows.map((row) => ({
          postId: toSafeInteger(row.id, 'postId'),
          boardSlug: row.board_slug,
          title: row.title,
          status: row.status,
          lockVersion: row.lock_version,
          scheduledAt: optionalIsoString(row.scheduled_at),
          publishedAt: optionalIsoString(row.published_at),
          updatedAt: toIsoString(row.updated_at),
        })),
      },
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalItems,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
    };
  }

  async getPost(rawPostId) {
    const postId = this.parsePostId(rawPostId);
    if (postId === null) throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');

    const post = await this.adminPostRepository.findPost(postId);
    if (!post) throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    const blocks = await this.adminPostRepository.findPostBlocks(postId);
    return {
      postId,
      boardSlug: post.board_slug,
      title: post.title,
      source: post.source_name === null ? null : { name: post.source_name, url: post.source_url },
      blocks: blocks.map((block) => this.mapBlock(block)),
      pinnedPosition: post.pinned_position,
      status: post.status,
      scheduledAt: optionalIsoString(post.scheduled_at),
      publishedAt: optionalIsoString(post.published_at),
      lockVersion: post.lock_version,
      createdAt: toIsoString(post.created_at),
      updatedAt: toIsoString(post.updated_at),
    };
  }

  mapBlock(block) {
    if (block.type === 'TEXT') return { type: 'TEXT', text: block.text_content };
    return {
      type: 'IMAGE',
      image: {
        imageId: toSafeInteger(block.image_id, 'imageId'),
        status: block.image_status,
        alt: block.alt_text,
        width: block.width,
        height: block.height,
        previewPath: `/api/v1/admin/images/${block.image_id}/preview`,
      },
    };
  }
}

module.exports = AdminPostService;
