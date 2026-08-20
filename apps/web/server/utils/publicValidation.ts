const BOARD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER

export function isBoardSlug(value: string | undefined): value is string {
  return Boolean(value && value.length <= 32 && BOARD_SLUG_PATTERN.test(value))
}

export function isPostId(value: string | undefined): value is string {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return false
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_SAFE_ID
}

export function parsePage(value: unknown): number | null {
  if (value === undefined) return 1
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000 ? parsed : null
}
