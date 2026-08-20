import { isBoardSlug } from './publicValidation'

type Issue = { field: string; reason: string }
type Validation<T> = { ok: true; value: T } | ({ ok: false } & Issue)
type JsonObject = Record<string, unknown>

const CREATE_FIELDS = new Set(['boardSlug', 'title', 'source', 'blocks', 'pinnedPosition'])
const UPDATE_FIELDS = new Set(['lockVersion', 'title', 'source', 'blocks', 'pinnedPosition'])
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function unknownField(value: JsonObject, allowed: Set<string>, prefix = ''): Issue | null {
  const field = Object.keys(value).find(field => !allowed.has(field))
  return field ? { field: prefix ? `${prefix}.${field}` : field, reason: 'notAllowed' } : null
}

function trimmed(value: unknown, field: string, max: number): Validation<string> {
  if (typeof value !== 'string') return { ok: false, field, reason: 'required' }
  const normalized = value.trim()
  return normalized.length >= 1 && normalized.length <= max
    ? { ok: true, value: normalized }
    : { ok: false, field, reason: 'length' }
}

function source(value: unknown): Validation<{ name: string; url: string } | null> {
  if (value === null) return { ok: true, value: null }
  if (!object(value)) return { ok: false, field: 'source', reason: 'objectOrNull' }
  const extra = unknownField(value, new Set(['name', 'url']), 'source')
  if (extra) return { ok: false, ...extra }
  const name = trimmed(value.name, 'source.name', 200)
  if (!name.ok) return name
  const url = trimmed(value.url, 'source.url', 2048)
  if (!url.ok) return url
  try {
    const parsed = new URL(url.value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error()
    return { ok: true, value: { name: name.value, url: parsed.toString() } }
  } catch {
    return { ok: false, field: 'source.url', reason: 'httpsUrl' }
  }
}

function pinned(value: unknown): Validation<number | null> {
  return value === null || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 3)
    ? { ok: true, value: value as number | null }
    : { ok: false, field: 'pinnedPosition', reason: 'integerRange' }
}

function blocks(value: unknown): Validation<Array<Record<string, unknown>>> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) {
    return { ok: false, field: 'blocks', reason: 'arrayLength' }
  }
  const normalized: Array<Record<string, unknown>> = []
  const imageIds: number[] = []
  for (let index = 0; index < value.length; index += 1) {
    const block = value[index]
    const field = `blocks[${index}]`
    if (!object(block)) return { ok: false, field, reason: 'object' }
    if (block.type === 'TEXT') {
      const extra = unknownField(block, new Set(['type', 'text']), field)
      if (extra) return { ok: false, ...extra }
      if (typeof block.text !== 'string') return { ok: false, field: `${field}.text`, reason: 'required' }
      if (block.text.trim().length < 1 || block.text.length > 20000) {
        return { ok: false, field: `${field}.text`, reason: 'length' }
      }
      normalized.push({ type: 'TEXT', text: block.text })
      continue
    }
    if (block.type === 'IMAGE') {
      const extra = unknownField(block, new Set(['type', 'imageId', 'alt']), field)
      if (extra) return { ok: false, ...extra }
      if (!Number.isSafeInteger(block.imageId) || (block.imageId as number) < 1) {
        return { ok: false, field: `${field}.imageId`, reason: 'positiveInteger' }
      }
      const alt = trimmed(block.alt, `${field}.alt`, 300)
      if (!alt.ok) return alt
      imageIds.push(block.imageId as number)
      normalized.push({ type: 'IMAGE', imageId: block.imageId, alt: alt.value })
      continue
    }
    return { ok: false, field: `${field}.type`, reason: 'unsupportedValue' }
  }
  if (imageIds.length > 20) return { ok: false, field: 'blocks', reason: 'tooManyImages' }
  if (new Set(imageIds).size !== imageIds.length) {
    return { ok: false, field: 'blocks', reason: 'duplicateImage' }
  }
  return { ok: true, value: normalized }
}

export function validateIdempotencyKey(value: string | undefined): Validation<string> {
  return typeof value === 'string' && IDEMPOTENCY_KEY_PATTERN.test(value)
    ? { ok: true, value }
    : { ok: false, field: 'Idempotency-Key', reason: 'requiredOrInvalid' }
}

export function validateAdminPostCreate(value: unknown): Validation<Record<string, unknown>> {
  if (!object(value)) return { ok: false, field: 'body', reason: 'object' }
  const extra = unknownField(value, CREATE_FIELDS)
  if (extra) return { ok: false, ...extra }
  if (typeof value.boardSlug !== 'string' || !isBoardSlug(value.boardSlug)) {
    return { ok: false, field: 'boardSlug', reason: 'invalidFormat' }
  }
  const title = trimmed(value.title, 'title', 200)
  if (!title.ok) return title
  const normalizedSource = value.source === undefined
    ? { ok: true as const, value: null }
    : source(value.source)
  if (!normalizedSource.ok) return normalizedSource
  const normalizedBlocks = blocks(value.blocks)
  if (!normalizedBlocks.ok) return normalizedBlocks
  const normalizedPinned = value.pinnedPosition === undefined
    ? { ok: true as const, value: null }
    : pinned(value.pinnedPosition)
  if (!normalizedPinned.ok) return normalizedPinned
  return {
    ok: true,
    value: {
      boardSlug: value.boardSlug,
      title: title.value,
      source: normalizedSource.value,
      blocks: normalizedBlocks.value,
      pinnedPosition: normalizedPinned.value,
    },
  }
}

export function validateAdminPostUpdate(value: unknown): Validation<Record<string, unknown>> {
  if (!object(value)) return { ok: false, field: 'body', reason: 'object' }
  const extra = unknownField(value, UPDATE_FIELDS)
  if (extra) return { ok: false, ...extra }
  if (!Number.isInteger(value.lockVersion) || (value.lockVersion as number) < 1) {
    return { ok: false, field: 'lockVersion', reason: 'positiveInteger' }
  }
  if (Object.keys(value).length === 1) return { ok: false, field: 'body', reason: 'noChanges' }
  const result: Record<string, unknown> = { lockVersion: value.lockVersion }
  if (value.title !== undefined) {
    const title = trimmed(value.title, 'title', 200)
    if (!title.ok) return title
    result.title = title.value
  }
  if (value.source !== undefined) {
    const normalizedSource = source(value.source)
    if (!normalizedSource.ok) return normalizedSource
    result.source = normalizedSource.value
  }
  if (value.blocks !== undefined) {
    const normalizedBlocks = blocks(value.blocks)
    if (!normalizedBlocks.ok) return normalizedBlocks
    result.blocks = normalizedBlocks.value
  }
  if (value.pinnedPosition !== undefined) {
    const normalizedPinned = pinned(value.pinnedPosition)
    if (!normalizedPinned.ok) return normalizedPinned
    result.pinnedPosition = normalizedPinned.value
  }
  return { ok: true, value: result }
}
