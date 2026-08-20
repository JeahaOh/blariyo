import { isIP } from 'node:net'
import { getHeader, getRequestIP, type H3Event } from 'h3'

const EVENT_FIELDS = {
  FEED_VIEW: { required: ['listPage', 'itemCount'], forbidden: ['postId'] },
  POST_VIEW: { required: ['postId'], forbidden: ['listPage', 'itemCount'] },
  DETAIL_LIST_VIEW: { required: ['postId', 'listPage', 'itemCount'], forbidden: [] },
} as const

const COMMON_FIELDS = ['eventType', 'anonymousId', 'sessionId', 'boardSlug', 'occurredAt'] as const
const BOARD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ID_PATTERN = /^[A-Za-z0-9_-]+$/
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const WINDOW_MS = 60_000
const REQUEST_LIMIT = 60
const rateBuckets = new Map<string, { startedAt: number, count: number }>()
let rateLimitChecks = 0

export function getRateLimitClientIp(event: H3Event) {
  const config = useRuntimeConfig(event)
  const trustedHeader = normalizeTrustedHeaderName(config.trustedClientIpHeader)
  const trustedValue = trustedHeader ? getHeader(event, trustedHeader) : undefined
  return selectRateLimitClientIp(getRequestIP(event), trustedValue)
}

export function normalizeTrustedHeaderName(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9-]{1,64}$/.test(normalized) ? normalized : ''
}

export function selectRateLimitClientIp(remoteIp: string | undefined, trustedValue?: string) {
  const value = trustedValue?.trim()
  if (value && !value.includes(',') && isIP(value)) return value
  return remoteIp || 'unknown'
}

export interface PublicEventPayload {
  eventType: 'FEED_VIEW' | 'POST_VIEW' | 'DETAIL_LIST_VIEW'
  anonymousId: string
  sessionId: string
  boardSlug: string
  postId?: number
  listPage?: number
  itemCount?: number
  occurredAt: string
}

export type EventValidation =
  | { ok: true, value: PublicEventPayload }
  | { ok: false, field: string, reason: string }

function positiveInteger(value: unknown, max: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= max
}

export function validatePublicEvent(value: unknown): EventValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, field: 'body', reason: 'objectRequired' }
  }
  const payload = value as Record<string, unknown>
  const eventType = payload.eventType
  if (typeof eventType !== 'string' || !(eventType in EVENT_FIELDS)) {
    return { ok: false, field: 'eventType', reason: 'unsupportedValue' }
  }
  const definition = EVENT_FIELDS[eventType as keyof typeof EVENT_FIELDS]
  const allowed = new Set<string>([...COMMON_FIELDS, ...definition.required])
  for (const field of Object.keys(payload)) {
    if (!allowed.has(field)) return { ok: false, field, reason: 'notAllowed' }
  }
  for (const field of [...COMMON_FIELDS, ...definition.required]) {
    if (payload[field] === undefined || payload[field] === null) {
      return { ok: false, field, reason: 'required' }
    }
  }
  for (const field of definition.forbidden) {
    if (payload[field] !== undefined) return { ok: false, field, reason: 'notAllowed' }
  }
  for (const field of ['anonymousId', 'sessionId'] as const) {
    const id = payload[field]
    if (typeof id !== 'string' || id.length < 16 || id.length > 128 || !ID_PATTERN.test(id)) {
      return { ok: false, field, reason: 'invalidFormat' }
    }
  }
  if (
    typeof payload.boardSlug !== 'string'
    || payload.boardSlug.length > 32
    || !BOARD_SLUG_PATTERN.test(payload.boardSlug)
  ) {
    return { ok: false, field: 'boardSlug', reason: 'invalidFormat' }
  }
  if (payload.postId !== undefined && !positiveInteger(payload.postId, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, field: 'postId', reason: 'integerRange' }
  }
  if (payload.listPage !== undefined && !positiveInteger(payload.listPage, 10_000)) {
    return { ok: false, field: 'listPage', reason: 'integerRange' }
  }
  if (
    payload.itemCount !== undefined
    && (!Number.isInteger(payload.itemCount) || Number(payload.itemCount) < 0 || Number(payload.itemCount) > 20)
  ) {
    return { ok: false, field: 'itemCount', reason: 'integerRange' }
  }
  if (
    typeof payload.occurredAt !== 'string'
    || payload.occurredAt.length > 40
    || !DATE_TIME_PATTERN.test(payload.occurredAt)
    || Number.isNaN(Date.parse(payload.occurredAt))
  ) {
    return { ok: false, field: 'occurredAt', reason: 'dateTime' }
  }
  return { ok: true, value: payload as unknown as PublicEventPayload }
}

export function consumeEventRateLimit(ip: string, now = Date.now()) {
  rateLimitChecks += 1
  if (rateLimitChecks % 256 === 0 || rateBuckets.size > 10_000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= WINDOW_MS) rateBuckets.delete(key)
    }
  }

  const current = rateBuckets.get(ip)
  if (!current || now - current.startedAt >= WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= REQUEST_LIMIT) return false
  current.count += 1
  return true
}
