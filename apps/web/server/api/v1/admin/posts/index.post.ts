import { proxyAdminJson } from '../../../../utils/adminCoreApi'
import { mapAdminPostCreatedResponse } from '../../../../utils/adminPostMapping'
import {
  validateAdminPostCreate,
  validateIdempotencyKey,
} from '../../../../utils/adminPostCommandValidation'
import { publicError } from '../../../../utils/publicErrors'

export default defineEventHandler(async (event): Promise<unknown> => {
  const key = validateIdempotencyKey(getHeader(event, 'idempotency-key'))
  if (!key.ok) return validationError(event, key)
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    return validationError(event, { field: 'body', reason: 'invalidJson' })
  }
  const validation = validateAdminPostCreate(body)
  if (!validation.ok) return validationError(event, validation)
  return proxyAdminJson(event, {
    path: '/internal/v1/admin/posts',
    method: 'POST',
    body: validation.value,
    headers: { 'Idempotency-Key': key.value },
    mapSuccess: mapAdminPostCreatedResponse,
  })
})

function validationError(event: Parameters<typeof publicError>[0], issue: { field: string; reason: string }) {
  return publicError(event, 400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [issue])
}
