import { InvalidCoreResponseError } from './publicContentMapping'

type JsonObject = Record<string, unknown>

const POST_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED'])
const IMAGE_STATUSES = new Set([
  'STAGED',
  'PUBLIC',
  'PUBLIC_DELETE_PENDING',
  'PRIVATE_REVIEW',
  'PRIVATE_DELETE_PENDING',
  'DELETED',
])

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
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new InvalidCoreResponseError(`Invalid ${field}`)
  }
  return value
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new InvalidCoreResponseError(`Invalid ${field}`)
  return value
}

function nullableString(value: unknown, field: string) {
  return value === null ? null : string(value, field)
}

function nullableNumber(value: unknown, field: string) {
  return value === null ? null : number(value, field)
}

function enumValue(value: unknown, values: Set<string>, field: string) {
  const mapped = string(value, field)
  if (!values.has(mapped)) throw new InvalidCoreResponseError(`Invalid ${field}`)
  return mapped
}

function root(value: unknown) {
  const response = object(value, 'response')
  if (response.success !== true) throw new InvalidCoreResponseError('Invalid success response')
  return response
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
  if (type === 'TEXT') return { type, text: string(block.text, 'post.block.text') }
  if (type !== 'IMAGE') throw new InvalidCoreResponseError('Invalid post.block.type')
  const image = object(block.image, 'post.block.image')
  return {
    type,
    image: {
      imageId: number(image.imageId, 'post.block.image.imageId'),
      status: enumValue(image.status, IMAGE_STATUSES, 'post.block.image.status'),
      alt: string(image.alt, 'post.block.image.alt'),
      width: number(image.width, 'post.block.image.width'),
      height: number(image.height, 'post.block.image.height'),
      previewPath: string(image.previewPath, 'post.block.image.previewPath'),
    },
  }
}

export function mapAdminPostsResponse(value: unknown) {
  const response = root(value)
  const data = object(response.data, 'data')
  const items = array(data.items, 'data.items')
  if (items.length > 50) throw new InvalidCoreResponseError('Too many admin post items')
  return {
    success: true as const,
    data: {
      items: items.map((value) => {
        const item = object(value, 'post item')
        return {
          postId: number(item.postId, 'item.postId'),
          boardSlug: string(item.boardSlug, 'item.boardSlug'),
          title: string(item.title, 'item.title'),
          status: enumValue(item.status, POST_STATUSES, 'item.status'),
          lockVersion: number(item.lockVersion, 'item.lockVersion'),
          scheduledAt: nullableString(item.scheduledAt, 'item.scheduledAt'),
          publishedAt: nullableString(item.publishedAt, 'item.publishedAt'),
          updatedAt: string(item.updatedAt, 'item.updatedAt'),
        }
      }),
    },
    meta: mapPagination(response.meta),
  }
}

export function mapAdminPostDetailResponse(value: unknown) {
  const response = root(value)
  const post = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      postId: number(post.postId, 'post.postId'),
      boardSlug: string(post.boardSlug, 'post.boardSlug'),
      title: string(post.title, 'post.title'),
      source: mapSource(post.source),
      blocks: array(post.blocks, 'post.blocks').map(mapBlock),
      pinnedPosition: nullableNumber(post.pinnedPosition, 'post.pinnedPosition'),
      status: enumValue(post.status, POST_STATUSES, 'post.status'),
      scheduledAt: nullableString(post.scheduledAt, 'post.scheduledAt'),
      publishedAt: nullableString(post.publishedAt, 'post.publishedAt'),
      lockVersion: number(post.lockVersion, 'post.lockVersion'),
      createdAt: string(post.createdAt, 'post.createdAt'),
      updatedAt: string(post.updatedAt, 'post.updatedAt'),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapAdminPostCreatedResponse(value: unknown) {
  const response = root(value)
  const post = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      postId: number(post.postId, 'post.postId'),
      status: enumValue(post.status, POST_STATUSES, 'post.status'),
      lockVersion: number(post.lockVersion, 'post.lockVersion'),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapAdminPostUpdatedResponse(value: unknown) {
  const response = root(value)
  const post = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      postId: number(post.postId, 'post.postId'),
      status: enumValue(post.status, POST_STATUSES, 'post.status'),
      lockVersion: number(post.lockVersion, 'post.lockVersion'),
      updatedAt: string(post.updatedAt, 'post.updatedAt'),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapAdminImageUploadResponse(value: unknown) {
  const response = root(value)
  const data = object(response.data, 'data')
  const items = array(data.items, 'data.items')
  if (items.length < 1 || items.length > 10) throw new InvalidCoreResponseError('Invalid image count')
  return {
    success: true as const,
    data: {
      items: items.map((value) => {
        const image = object(value, 'image')
        return {
          imageId: number(image.imageId, 'image.imageId'),
          status: enumValue(image.status, IMAGE_STATUSES, 'image.status'),
          mimeType: string(image.mimeType, 'image.mimeType'),
          byteSize: number(image.byteSize, 'image.byteSize'),
          width: number(image.width, 'image.width'),
          height: number(image.height, 'image.height'),
          previewPath: string(image.previewPath, 'image.previewPath'),
        }
      }),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapAdminImageDiscardResponse(value: unknown) {
  const response = root(value)
  const image = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      imageId: number(image.imageId, 'image.imageId'),
      status: enumValue(image.status, IMAGE_STATUSES, 'image.status'),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapAdminPostPublishResponse(value: unknown) {
  const response = root(value)
  const post = object(response.data, 'data')
  return {
    success: true as const,
    data: {
      postId: number(post.postId, 'post.postId'),
      status: enumValue(post.status, POST_STATUSES, 'post.status'),
      lockVersion: number(post.lockVersion, 'post.lockVersion'),
      publishedAt: nullableString(post.publishedAt, 'post.publishedAt'),
      scheduledAt: nullableString(post.scheduledAt, 'post.scheduledAt'),
    },
    meta: mapMeta(response.meta),
  }
}

export function mapAdminPostTransitionResponse(value: unknown) {
  const response = root(value)
  const post = object(response.data, 'data')
  const data: Record<string, unknown> = {
    postId: number(post.postId, 'post.postId'),
    status: enumValue(post.status, POST_STATUSES, 'post.status'),
    lockVersion: number(post.lockVersion, 'post.lockVersion'),
    updatedAt: string(post.updatedAt, 'post.updatedAt'),
  }
  if (post.scheduledAt !== undefined) {
    data.scheduledAt = nullableString(post.scheduledAt, 'post.scheduledAt')
  }
  return { success: true as const, data, meta: mapMeta(response.meta) }
}
