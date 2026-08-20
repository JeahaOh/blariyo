import { proxyPublicGet } from '../../../../../utils/coreApi'
import { mapPostsResponse } from '../../../../../utils/publicContentMapping'
import { boardNotFound, invalidPage } from '../../../../../utils/publicErrors'
import { isBoardSlug, parsePage } from '../../../../../utils/publicValidation'

export default defineEventHandler((event) => {
  const boardSlug = getRouterParam(event, 'boardSlug')
  if (!isBoardSlug(boardSlug)) return boardNotFound(event)

  const page = parsePage(getQuery(event).page)
  if (page === null) return invalidPage(event)

  return proxyPublicGet(event, {
    path: `/internal/v1/boards/${encodeURIComponent(boardSlug)}/posts?page=${page}`,
    cacheControl: 'public, max-age=60',
    mapSuccess: mapPostsResponse,
  })
})
