type Issue = { field: string; reason: string }
type Validation<T> = { ok: true; value: T } | ({ ok: false } & Issue)
type JsonObject = Record<string, unknown>

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: JsonObject, allowed: Set<string>): Issue | null {
  const field = Object.keys(value).find(field => !allowed.has(field))
  return field ? { field, reason: 'notAllowed' } : null
}

function lockVersion(value: unknown): Validation<number> {
  return Number.isInteger(value) && (value as number) >= 1
    ? { ok: true, value: value as number }
    : { ok: false, field: 'lockVersion', reason: 'positiveInteger' }
}

export function validateAdminPostPublish(
  value: unknown,
  now = new Date(),
): Validation<Record<string, unknown>> {
  if (!object(value)) return { ok: false, field: 'body', reason: 'object' }
  const extra = exact(value, new Set(['lockVersion', 'mode', 'scheduledAt']))
  if (extra) return { ok: false, ...extra }
  const version = lockVersion(value.lockVersion)
  if (!version.ok) return version
  if (value.mode === 'IMMEDIATE') {
    if (value.scheduledAt !== undefined) {
      return { ok: false, field: 'scheduledAt', reason: 'notAllowed' }
    }
    return { ok: true, value: { lockVersion: version.value, mode: 'IMMEDIATE' } }
  }
  if (value.mode !== 'SCHEDULED') {
    return { ok: false, field: 'mode', reason: 'unsupportedValue' }
  }
  if (typeof value.scheduledAt !== 'string'
    || !DATE_TIME_PATTERN.test(value.scheduledAt)
    || Number.isNaN(Date.parse(value.scheduledAt))) {
    return { ok: false, field: 'scheduledAt', reason: 'dateTime' }
  }
  const scheduledAt = new Date(value.scheduledAt)
  if (scheduledAt.getTime() < now.getTime() + 60_000) {
    return { ok: false, field: 'scheduledAt', reason: 'minimumLeadTime' }
  }
  return {
    ok: true,
    value: { lockVersion: version.value, mode: 'SCHEDULED', scheduledAt: scheduledAt.toISOString() },
  }
}

export function validateAdminPostUnschedule(value: unknown): Validation<Record<string, unknown>> {
  if (!object(value)) return { ok: false, field: 'body', reason: 'object' }
  const extra = exact(value, new Set(['lockVersion']))
  if (extra) return { ok: false, ...extra }
  const version = lockVersion(value.lockVersion)
  return version.ok
    ? { ok: true, value: { lockVersion: version.value } }
    : version
}

export function validateAdminPostHide(value: unknown): Validation<Record<string, unknown>> {
  if (!object(value)) return { ok: false, field: 'body', reason: 'object' }
  const extra = exact(value, new Set(['lockVersion', 'reasonCode']))
  if (extra) return { ok: false, ...extra }
  const version = lockVersion(value.lockVersion)
  if (!version.ok) return version
  if (value.reasonCode !== 'RIGHTS_EMAIL') {
    return { ok: false, field: 'reasonCode', reason: 'unsupportedValue' }
  }
  return {
    ok: true,
    value: { lockVersion: version.value, reasonCode: 'RIGHTS_EMAIL' },
  }
}

export function validateAdminPostRepublish(value: unknown): Validation<Record<string, unknown>> {
  if (!object(value)) return { ok: false, field: 'body', reason: 'object' }
  const extra = exact(value, new Set(['lockVersion', 'pinnedPosition']))
  if (extra) return { ok: false, ...extra }
  const version = lockVersion(value.lockVersion)
  if (!version.ok) return version
  if (!Object.prototype.hasOwnProperty.call(value, 'pinnedPosition')) {
    return { ok: false, field: 'pinnedPosition', reason: 'required' }
  }
  if (value.pinnedPosition !== null
    && (!Number.isInteger(value.pinnedPosition)
      || (value.pinnedPosition as number) < 1
      || (value.pinnedPosition as number) > 3)) {
    return { ok: false, field: 'pinnedPosition', reason: 'integerRange' }
  }
  return {
    ok: true,
    value: { lockVersion: version.value, pinnedPosition: value.pinnedPosition },
  }
}

export function validateAdminPostRemove(value: unknown): Validation<Record<string, unknown>> {
  return validateAdminPostHide(value)
}
