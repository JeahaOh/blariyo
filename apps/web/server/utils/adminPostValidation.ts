import { isBoardSlug, isPostId, parsePage } from './publicValidation'

const POST_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED'])
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const SEARCH_FIELDS = new Set(['status', 'board', 'titlePrefix', 'from', 'to', 'page'])

export type AdminPostSearchValidation =
  | { ok: true; queryString: string }
  | { ok: false; field: string; reason: string }

export function validateAdminPostSearch(query: Record<string, unknown>): AdminPostSearchValidation {
  for (const field of Object.keys(query)) {
    if (!SEARCH_FIELDS.has(field)) return { ok: false, field, reason: 'notAllowed' }
    if (typeof query[field] !== 'string') {
      return { ok: false, field, reason: 'singleValueRequired' }
    }
  }

  const params = new URLSearchParams()
  if (query.status !== undefined) {
    if (!POST_STATUSES.has(query.status as string)) {
      return { ok: false, field: 'status', reason: 'unsupportedValue' }
    }
    params.set('status', query.status as string)
  }
  if (query.board !== undefined) {
    if (!isBoardSlug(query.board as string)) {
      return { ok: false, field: 'board', reason: 'invalidFormat' }
    }
    params.set('board', query.board as string)
  }
  if (query.titlePrefix !== undefined) {
    const value = (query.titlePrefix as string).trim()
    if (value.length < 1 || value.length > 100) {
      return { ok: false, field: 'titlePrefix', reason: 'length' }
    }
    params.set('titlePrefix', value)
  }
  for (const field of ['from', 'to'] as const) {
    const value = query[field]
    if (value !== undefined) {
      if (!DATE_TIME_PATTERN.test(value as string) || Number.isNaN(Date.parse(value as string))) {
        return { ok: false, field, reason: 'dateTime' }
      }
      params.set(field, value as string)
    }
  }
  if (
    query.from !== undefined
    && query.to !== undefined
    && new Date(query.from as string) > new Date(query.to as string)
  ) {
    return { ok: false, field: 'to', reason: 'beforeFrom' }
  }

  const page = parsePage(query.page)
  if (page === null) return { ok: false, field: 'page', reason: 'integerRange' }
  params.set('page', String(page))
  return { ok: true, queryString: params.toString() }
}

export function isAdminPostId(value: string | undefined): value is string {
  return isPostId(value)
}
