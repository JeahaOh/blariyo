import { publicError } from '../../utils/publicErrors'

export default defineEventHandler((event) =>
  publicError(
    event,
    404,
    'ROUTE_NOT_FOUND',
    '요청한 경로를 찾을 수 없습니다.',
  ),
)
