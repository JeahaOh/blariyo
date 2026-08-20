import { mapBoardsResponse } from '../../../utils/publicContentMapping'
import { proxyPublicGet } from '../../../utils/coreApi'

export default defineEventHandler((event) =>
  proxyPublicGet(event, {
    path: '/internal/v1/boards',
    cacheControl: 'public, max-age=60',
    mapSuccess: mapBoardsResponse,
  }),
)
