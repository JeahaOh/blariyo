type JsonObject = Record<string, unknown>

export class InvalidCoreResponseError extends Error {}

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidCoreResponseError(`Invalid ${field}`)
  }
  return value as JsonObject
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new InvalidCoreResponseError(`Invalid ${field}`)
  return value
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new InvalidCoreResponseError(`Invalid ${field}`)
  return value
}

function number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidCoreResponseError(`Invalid ${field}`)
  }
  return value
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new InvalidCoreResponseError(`Invalid ${field}`)
  return value
}

function mapMeta(value: unknown) {
  const meta = object(value, 'meta')
  return { requestId: string(meta.requestId, 'meta.requestId') }
}

function mapPagination(value: unknown) {
  const meta = object(value, 'meta')
  return {
    requestId: string(meta.requestId, 'meta.requestId'),
    page: number(meta.page, 'meta.page'),
    pageSize: number(meta.pageSize, 'meta.pageSize'),
    totalItems: number(meta.totalItems, 'meta.totalItems'),
    totalPages: number(meta.totalPages, 'meta.totalPages'),
    hasPrevious: boolean(meta.hasPrevious, 'meta.hasPrevious'),
    hasNext: boolean(meta.hasNext, 'meta.hasNext'),
  }
}

function mapBoard(value: unknown) {
  const board = object(value, 'board')
  return {
    slug: string(board.slug, 'board.slug'),
    displayName: string(board.displayName, 'board.displayName'),
  }
}

function mapListItem(value: unknown) {
  const item = object(value, 'post item')
  const mapped: Record<string, unknown> = {
    postId: number(item.postId, 'item.postId'),
    title: string(item.title, 'item.title'),
    viewCount: number(item.viewCount, 'item.viewCount'),
    authorLabel: string(item.authorLabel, 'item.authorLabel'),
    publishedAt: string(item.publishedAt, 'item.publishedAt'),
    path: string(item.path, 'item.path'),
  }
  if (item.current !== undefined) mapped.current = boolean(item.current, 'item.current')
  return mapped
}

function mapSource(value: unknown) {
  if (value === null) return null
  const source = object(value, 'post.source')
  return {
    name: string(source.name, 'post.source.name'),
    url: string(source.url, 'post.source.url'),
  }
}

function mapBlock(value: unknown) {
  const block = object(value, 'post.block')
  const type = string(block.type, 'post.block.type')
  if (type === 'TEXT') {
    return { type, text: string(block.text, 'post.block.text') }
  }
  if (type === 'IMAGE') {
    const image = object(block.image, 'post.block.image')
    return {
      type,
      image: {
        url: string(image.url, 'post.block.image.url'),
        alt: string(image.alt, 'post.block.image.alt'),
        width: number(image.width, 'post.block.image.width'),
        height: number(image.height, 'post.block.image.height'),
      },
    }
  }
  throw new InvalidCoreResponseError('Invalid post.block.type')
}

function root(value: unknown) {
  const response = object(value, 'response')
  if (response.success !== true) throw new InvalidCoreResponseError('Invalid success response')
  return response
}

export function mapBoardsResponse(value: unknown) {
  const response = root(value)
  const data = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      items: array(data.items, 'data.items').map((value) => {
        const item = object(value, 'board item')
        return {
          slug: string(item.slug, 'board.slug'),
          displayName: string(item.displayName, 'board.displayName'),
          postingPolicy: string(item.postingPolicy, 'board.postingPolicy'),
          path: string(item.path, 'board.path'),
        }
      }),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapPostsResponse(value: unknown) {
  const response = root(value)
  const data = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      board: mapBoard(data.board),
      pinnedItems: array(data.pinnedItems, 'data.pinnedItems').map(mapListItem),
      items: array(data.items, 'data.items').map(mapListItem),
    },
    meta: mapPagination(response.meta),
  }
}

export function mapPostDetailResponse(value: unknown) {
  const response = root(value)
  const data = object(response.data, 'data')
  const post = object(data.post, 'data.post')
  const context = object(data.context, 'data.context')
  return {
    success: true as const,
    data: {
      post: {
        postId: number(post.postId, 'post.postId'),
        board: mapBoard(post.board),
        title: string(post.title, 'post.title'),
        authorLabel: string(post.authorLabel, 'post.authorLabel'),
        publishedAt: string(post.publishedAt, 'post.publishedAt'),
        viewCount: number(post.viewCount, 'post.viewCount'),
        blocks: array(post.blocks, 'post.blocks').map(mapBlock),
        source: mapSource(post.source),
        shareUrl: string(post.shareUrl, 'post.shareUrl'),
      },
      context: {
        pinnedItems: array(context.pinnedItems, 'context.pinnedItems').map(mapListItem),
        listPage: number(context.listPage, 'context.listPage'),
        items: array(context.items, 'context.items').map(mapListItem),
        pageSize: number(context.pageSize, 'context.pageSize'),
        totalItems: number(context.totalItems, 'context.totalItems'),
        totalPages: number(context.totalPages, 'context.totalPages'),
      },
    },
    meta: mapMeta(response.meta),
  }
}

const PUBLIC_ERRORS: Record<string, { status: number; message: string }> = {
  VALIDATION_FAILED: { status: 400, message: '입력값을 확인해 주세요.' },
  REQUEST_TOO_LARGE: { status: 413, message: '요청 크기를 줄여 주세요.' },
  BOARD_NOT_FOUND: { status: 404, message: '게시판을 찾을 수 없습니다.' },
  PAGE_NOT_FOUND: { status: 404, message: '페이지를 찾을 수 없습니다.' },
  POST_NOT_FOUND: { status: 404, message: '게시글을 찾을 수 없습니다.' },
  POLICY_NOT_FOUND: { status: 404, message: '정책을 찾을 수 없습니다.' },
  IMAGE_NOT_FOUND: { status: 404, message: '이미지를 찾을 수 없습니다.' },
  POST_STATE_CONFLICT: { status: 409, message: '현재 게시글 상태에서는 처리할 수 없습니다.' },
  POST_VERSION_CONFLICT: { status: 409, message: '게시글이 다른 요청에 의해 변경되었습니다.' },
  PINNED_ORDER_CONFLICT: { status: 409, message: '이미 사용 중인 공지 순서입니다.' },
  IDEMPOTENCY_CONFLICT: { status: 409, message: '같은 멱등키가 다른 요청에 사용되었습니다.' },
  IDEMPOTENCY_IN_PROGRESS: { status: 409, message: '같은 멱등 요청을 처리 중입니다.' },
  IMAGE_ALREADY_ATTACHED: { status: 409, message: '이미 다른 게시글에 연결된 이미지입니다.' },
  IMAGE_STATE_CONFLICT: { status: 409, message: '현재 이미지 상태에서는 처리할 수 없습니다.' },
  UPLOAD_TOO_LARGE: { status: 413, message: '업로드 크기를 줄여 주세요.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: '지원하지 않는 파일 형식입니다.' },
  INTERNAL_ERROR: { status: 500, message: '일시적인 오류가 발생했습니다.' },
  DEPENDENCY_UNAVAILABLE: { status: 503, message: '일시적으로 서비스를 이용할 수 없습니다.' },
}

export function mapErrorResponse(value: unknown, status: number) {
  const response = object(value, 'error response')
  const error = object(response.error, 'error')
  const meta = mapMeta(response.meta)
  if (response.success !== false) throw new InvalidCoreResponseError('Invalid error response')
  const code = string(error.code, 'error.code')
  const definition = PUBLIC_ERRORS[code]
  if (!definition || definition.status !== status) {
    throw new InvalidCoreResponseError('Unexpected public error')
  }
  const fields = array(error.fields, 'error.fields')
  return {
    success: false as const,
    error: {
      code,
      message: definition.message,
      fields: code === 'VALIDATION_FAILED' ? fields.map((value) => {
        const field = object(value, 'error.fields[]')
        return {
          field: string(field.field, 'error.fields[].field'),
          reason: string(field.reason, 'error.fields[].reason'),
        }
      }) : [],
    },
    meta,
  }
}
