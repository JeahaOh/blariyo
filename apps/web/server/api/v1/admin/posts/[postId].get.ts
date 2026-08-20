import { proxyAdminGet } from '../../../../utils/adminCoreApi'
import { mapAdminPostDetailResponse } from '../../../../utils/adminPostMapping'
import { isAdminPostId } from '../../../../utils/adminPostValidation'
import { postNotFound } from '../../../../utils/publicErrors'

export default defineEventHandler((event): unknown => {
  const postId = getRouterParam(event, 'postId')
  if (!isAdminPostId(postId)) return postNotFound(event)
  return proxyAdminGet(event, {
    path: `/internal/v1/admin/posts/${postId}`,
    mapSuccess: mapAdminPostDetailResponse,
  })
})
