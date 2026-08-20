const AppError = require('../errors/appError');

const PAGE_SIZE = 20;
const BOARD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

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

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

class PublicContentService {
  constructor({ boardRepository, postRepository, mediaBaseUrl, serviceBaseUrl }) {
    this.boardRepository = boardRepository;
    this.postRepository = postRepository;
    this.mediaBaseUrl = mediaBaseUrl;
    this.serviceBaseUrl = serviceBaseUrl;
  }

  parsePage(rawPage) {
    if (rawPage === undefined) return 1;
    if (!POSITIVE_INTEGER_PATTERN.test(rawPage)) {
      throw new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
        { field: 'page', reason: 'integerRange' },
      ]);
    }
    const page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page > 10000) {
      throw new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
        { field: 'page', reason: 'integerRange' },
      ]);
    }
    return page;
  }

  isValidBoardSlug(boardSlug) {
    return typeof boardSlug === 'string' && boardSlug.length <= 32 && BOARD_SLUG_PATTERN.test(boardSlug);
  }

  parsePostId(rawPostId) {
    if (!POSITIVE_INTEGER_PATTERN.test(rawPostId)) return null;
    const postId = Number(rawPostId);
    return Number.isSafeInteger(postId) ? postId : null;
  }

  async getActiveBoards() {
    const boards = await this.boardRepository.findActiveBoards();
    return {
      items: boards.map((board) => ({
        slug: board.slug,
        displayName: board.display_name,
        postingPolicy: board.posting_policy,
        path: `/${board.slug}`,
      })),
    };
  }

  mapListItem(boardSlug, row, { current = false } = {}) {
    const item = {
      postId: toSafeInteger(row.id, 'postId'),
      title: row.title,
      viewCount: toSafeInteger(row.view_count, 'viewCount'),
      authorLabel: '운영자',
      publishedAt: toIsoString(row.published_at),
      path: `/${boardSlug}/posts/${row.id}`,
    };
    if (current) item.current = true;
    return item;
  }

  async getPostList(boardSlug, rawPage) {
    if (!this.isValidBoardSlug(boardSlug)) {
      throw new AppError(404, 'BOARD_NOT_FOUND', '게시판을 찾을 수 없습니다.');
    }

    const page = this.parsePage(rawPage);
    const board = await this.boardRepository.findActiveBoardBySlug(boardSlug);
    if (!board) throw new AppError(404, 'BOARD_NOT_FOUND', '게시판을 찾을 수 없습니다.');

    return this.buildListResult(board, page);
  }

  async buildListResult(board, page, currentPostId = null) {
    const [totalItems, pinnedRows] = await Promise.all([
      this.postRepository.countPublicRegularPosts(board.id),
      this.postRepository.findPublicPinnedPosts(board.id),
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / PAGE_SIZE);
    if ((totalItems === 0 && page !== 1) || (totalItems > 0 && page > totalPages)) {
      throw new AppError(404, 'PAGE_NOT_FOUND', '페이지를 찾을 수 없습니다.');
    }

    const regularRows = await this.postRepository.findPublicRegularPosts(board.id, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });

    return {
      data: {
        board: { slug: board.slug, displayName: board.display_name },
        pinnedItems: pinnedRows.map((row) =>
          this.mapListItem(board.slug, row, {
            current: currentPostId !== null && toSafeInteger(row.id, 'postId') === currentPostId,
          })
        ),
        items: regularRows.map((row) =>
          this.mapListItem(board.slug, row, {
            current: currentPostId !== null && toSafeInteger(row.id, 'postId') === currentPostId,
          })
        ),
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

  mapBlock(block) {
    if (block.type === 'TEXT') return { type: 'TEXT', text: block.text_content };
    if (block.image_status !== 'PUBLIC' || !block.public_storage_key) {
      throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }
    return {
      type: 'IMAGE',
      image: {
        url: joinUrl(this.mediaBaseUrl, block.public_storage_key),
        alt: block.alt_text,
        width: block.width,
        height: block.height,
      },
    };
  }

  async getPostDetail(boardSlug, rawPostId) {
    const postId = this.parsePostId(rawPostId);
    if (!this.isValidBoardSlug(boardSlug) || postId === null) {
      throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }

    const post = await this.postRepository.findPublicPost(boardSlug, postId);
    if (!post) throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');

    const [blocks, newerCount] = await Promise.all([
      this.postRepository.findPostBlocks(post.id),
      post.pinned_position === null
        ? this.postRepository.countNewerPublicRegularPosts(post)
        : Promise.resolve(0),
    ]);
    if (blocks.length === 0) {
      throw new AppError(404, 'POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }
    const listPage = post.pinned_position === null ? Math.floor(newerCount / PAGE_SIZE) + 1 : 1;
    const listResult = await this.buildListResult(
      { id: post.board_id, slug: post.board_slug, display_name: post.board_display_name },
      listPage,
      postId
    );

    return {
      post: {
        postId,
        board: { slug: post.board_slug, displayName: post.board_display_name },
        title: post.title,
        authorLabel: '운영자',
        publishedAt: toIsoString(post.published_at),
        viewCount: toSafeInteger(post.view_count, 'viewCount'),
        blocks: blocks.map((block) => this.mapBlock(block)),
        source:
          post.source_name === null
            ? null
            : { name: post.source_name, url: post.source_url },
        shareUrl: joinUrl(this.serviceBaseUrl, `/${post.board_slug}/posts/${post.id}`),
      },
      context: {
        pinnedItems: listResult.data.pinnedItems,
        listPage,
        items: listResult.data.items,
        pageSize: PAGE_SIZE,
        totalItems: listResult.pagination.totalItems,
        totalPages: listResult.pagination.totalPages,
      },
    };
  }
}

module.exports = PublicContentService;
