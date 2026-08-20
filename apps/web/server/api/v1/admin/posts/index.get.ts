import { proxyAdminGet } from '../../../../utils/adminCoreApi'
import { mapAdminPostsResponse } from '../../../../utils/adminPostMapping'
import { validateAdminPostSearch } from '../../../../utils/adminPostValidation'
import { publicError } from '../../../../utils/publicErrors'

export default defineEventHandler((event): unknown => {
  const validation = validateAdminPostSearch(getQuery(event))
  if (!validation.ok) {
    return publicError(
      event,
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      [{ field: validation.field, reason: validation.reason }],
    )
  }
  return proxyAdminGet(event, {
    path: `/internal/v1/admin/posts?${validation.queryString}`,
    mapSuccess: mapAdminPostsResponse,
  })
})
