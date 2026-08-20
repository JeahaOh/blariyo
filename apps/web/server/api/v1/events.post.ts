import { proxyPublicEvent } from '../../utils/coreApi'
import {
  consumeEventRateLimit,
  getRateLimitClientIp,
  validatePublicEvent,
} from '../../utils/publicEvent'
import { publicError } from '../../utils/publicErrors'

export default defineEventHandler(async (event) => {
  const ip = getRateLimitClientIp(event)
  if (!consumeEventRateLimit(ip)) {
    setHeader(event, 'Retry-After', 60)
    return publicError(event, 429, 'RATE_LIMITED', '요청이 너무 많습니다.')
  }

  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    return publicError(
      event,
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      [{ field: 'body', reason: 'invalidJson' }],
    )
  }
  const validation = validatePublicEvent(body)
  if (!validation.ok) {
    return publicError(
      event,
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      [{ field: validation.field, reason: validation.reason }],
    )
  }
  return proxyPublicEvent(event, validation.value)
})
