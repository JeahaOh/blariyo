import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'

export interface ErrorField {
  field: string
  reason: string
}

export function publicError(
  event: H3Event,
  status: number,
  code: string,
  message: string,
  fields: ErrorField[] = [],
  requestId = randomUUID(),
) {
  setResponseStatus(event, status)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Request-Id', requestId)

  return {
    success: false as const,
    error: { code, message, fields },
    meta: { requestId },
  }
}

export function boardNotFound(event: H3Event) {
  return publicError(
    event,
    404,
    'BOARD_NOT_FOUND',
    '게시판을 찾을 수 없습니다.',
  )
}

export function postNotFound(event: H3Event) {
  return publicError(
    event,
    404,
    'POST_NOT_FOUND',
    '게시글을 찾을 수 없습니다.',
  )
}

export function policyNotFound(event: H3Event) {
  return publicError(
    event,
    404,
    'POLICY_NOT_FOUND',
    '정책을 찾을 수 없습니다.',
  )
}

export function invalidPage(event: H3Event) {
  return publicError(
    event,
    400,
    'VALIDATION_FAILED',
    '입력값을 확인해 주세요.',
    [{ field: 'page', reason: 'integerRange' }],
  )
}

export function dependencyUnavailable(event: H3Event) {
  return publicError(
    event,
    503,
    'DEPENDENCY_UNAVAILABLE',
    '일시적으로 서비스를 이용할 수 없습니다.',
  )
}
