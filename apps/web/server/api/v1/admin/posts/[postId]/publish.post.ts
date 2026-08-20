import { proxyAdminJson } from '../../../../../utils/adminCoreApi'
import { mapAdminPostPublishResponse } from '../../../../../utils/adminPostMapping'
import { validateAdminPostPublish } from '../../../../../utils/adminPostLifecycleValidation'
import { validateIdempotencyKey } from '../../../../../utils/adminPostCommandValidation'
import { isAdminPostId } from '../../../../../utils/adminPostValidation'
import { postNotFound, publicError } from '../../../../../utils/publicErrors'

export default defineEventHandler(async (event): Promise<unknown> => {
  const postId = getRouterParam(event, 'postId')
  if (!isAdminPostId(postId)) return postNotFound(event)
  const key = validateIdempotencyKey(getHeader(event, 'idempotency-key'))
  if (!key.ok) return validationError(event, key)
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    return validationError(event, { field: 'body', reason: 'invalidJson' })
  }
  const validation = validateAdminPostPublish(body)
  if (!validation.ok) return validationError(event, validation)
  return proxyAdminJson(event, {
    path: `/internal/v1/admin/posts/${postId}/publish`,
    method: 'POST',
    body: validation.value,
    headers: { 'Idempotency-Key': key.value },
    mapSuccess: mapAdminPostPublishResponse,
  })
})

function validationError(event: Parameters<typeof publicError>[0], issue: { field: string; reason: string }) {
  return publicError(event, 400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [issue])
}
