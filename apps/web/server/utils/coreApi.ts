import type { H3Event } from 'h3'
import { InvalidCoreResponseError, mapErrorResponse } from './publicContentMapping'
import { dependencyUnavailable } from './publicErrors'

type PublicSuccessResponse = { meta: { requestId: string } }
type SuccessMapper<T extends PublicSuccessResponse> = (value: unknown) => T

interface ProxyOptions<T extends PublicSuccessResponse> {
  path: string
  cacheControl: 'public, max-age=60' | 'public, max-age=300' | 'public, max-age=60, s-maxage=300'
  mapSuccess: SuccessMapper<T>
}

export async function proxyPublicEvent(event: H3Event, body: object) {
  const config = useRuntimeConfig(event)
  const timeout = Number(config.coreApiTimeoutMs)

  try {
    const response = await $fetch.raw<unknown>('/internal/v1/events', {
      baseURL: String(config.coreApiBaseUrl),
      method: 'POST',
      body,
      ignoreResponseError: true,
      retry: 0,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 3000,
    })
    const requestId = response.headers.get('x-request-id')
    if (!requestId) throw new InvalidCoreResponseError('Missing Core request ID')
    if (response.status === 204) {
      setResponseStatus(event, 204)
      setHeader(event, 'Cache-Control', 'no-store')
      setHeader(event, 'X-Request-Id', requestId)
      return null
    }

    const mapped = mapErrorResponse(response._data, response.status)
    setResponseStatus(event, response.status)
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'X-Request-Id', mapped.meta.requestId)
    return mapped
  } catch (error) {
    if (!(error instanceof InvalidCoreResponseError) && import.meta.dev) {
      console.error('Core API request failed', error)
    }
    return dependencyUnavailable(event)
  }
}

export async function proxyPublicGet<T extends PublicSuccessResponse>(
  event: H3Event,
  options: ProxyOptions<T>,
) {
  const config = useRuntimeConfig(event)
  const timeout = Number(config.coreApiTimeoutMs)

  try {
    const response = await $fetch.raw<unknown>(options.path, {
      baseURL: String(config.coreApiBaseUrl),
      method: 'GET',
      ignoreResponseError: true,
      retry: 0,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 3000,
    })

    if (response.status >= 200 && response.status < 300) {
      const body = options.mapSuccess(response._data)
      setResponseStatus(event, response.status)
      setHeader(event, 'Cache-Control', options.cacheControl)
      setHeader(event, 'X-Request-Id', body.meta.requestId)
      return body
    }

    const body = mapErrorResponse(response._data, response.status)
    setResponseStatus(event, response.status)
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'X-Request-Id', body.meta.requestId)
    return body
  } catch (error) {
    if (!(error instanceof InvalidCoreResponseError) && import.meta.dev) {
      console.error('Core API request failed', error)
    }
    return dependencyUnavailable(event)
  }
}
