import { proxyPublicGet } from '../../../../../utils/coreApi'
import { mapPostDetailResponse } from '../../../../../utils/publicContentMapping'
import { postNotFound } from '../../../../../utils/publicErrors'
import { isBoardSlug, isPostId } from '../../../../../utils/publicValidation'

export default defineEventHandler((event) => {
  const boardSlug = getRouterParam(event, 'boardSlug')
  const postId = getRouterParam(event, 'postId')
  if (!isBoardSlug(boardSlug) || !isPostId(postId)) return postNotFound(event)

  return proxyPublicGet(event, {
    path: `/internal/v1/boards/${encodeURIComponent(boardSlug)}/posts/${postId}`,
    cacheControl: 'public, max-age=300',
    mapSuccess: mapPostDetailResponse,
  })
})
