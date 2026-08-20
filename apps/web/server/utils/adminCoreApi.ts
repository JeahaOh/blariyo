import type { H3Event } from 'h3'
import { buildAdminCoreHeaders } from './adminCoreHeaders'
import { getAdminPrincipal } from './adminIdentity'
import { InvalidCoreResponseError, mapErrorResponse } from './publicContentMapping'
import { dependencyUnavailable } from './publicErrors'

type AdminSuccessResponse = { meta: { requestId: string } }

interface AdminJsonOptions<T extends AdminSuccessResponse> {
  path: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  mapSuccess: (value: unknown) => T
}

export async function proxyAdminJson<T extends AdminSuccessResponse>(
  event: H3Event,
  options: AdminJsonOptions<T>,
): Promise<unknown> {
  const config = useRuntimeConfig(event)
  const timeout = Number(config.coreApiTimeoutMs)

  try {
    const response: { status: number; _data?: unknown } = await $fetch.raw<unknown>(options.path, {
      baseURL: String(config.coreApiBaseUrl),
      method: options.method || 'GET',
      headers: {
        ...buildAdminCoreHeaders(event, getAdminPrincipal(event)),
        ...options.headers,
      },
      body: options.body as never,
      ignoreResponseError: true,
      retry: 0,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 3000,
    })

    const body: AdminSuccessResponse = response.status >= 200 && response.status < 300
      ? options.mapSuccess(response._data)
      : mapErrorResponse(response._data, response.status)
    setResponseStatus(event, response.status)
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'X-Request-Id', body.meta.requestId)
    if ('error' in body
      && (body as { error?: { code?: string } }).error?.code === 'IDEMPOTENCY_IN_PROGRESS') {
      setHeader(event, 'Retry-After', 1)
    }
    return body
  } catch (error) {
    if (!(error instanceof InvalidCoreResponseError) && import.meta.dev) {
      console.error('Admin Core API request failed', error)
    }
    return dependencyUnavailable(event)
  }
}

export async function proxyAdminGet<T extends AdminSuccessResponse>(
  event: H3Event,
  options: { path: string; mapSuccess: (value: unknown) => T },
): Promise<unknown> {
  return proxyAdminJson(event, options)
}

export async function proxyAdminImagePreview(event: H3Event, path: string): Promise<unknown> {
  const config = useRuntimeConfig(event)
  const timeout = Number(config.coreApiTimeoutMs)
  try {
    const response = await fetch(new URL(path, String(config.coreApiBaseUrl)), {
      method: 'GET',
      headers: buildAdminCoreHeaders(event, getAdminPrincipal(event)),
      signal: AbortSignal.timeout(Number.isFinite(timeout) && timeout > 0 ? timeout : 3000),
    })
    if (!response.ok) {
      const mapped = mapErrorResponse(await response.json(), response.status)
      setResponseStatus(event, response.status)
      setHeader(event, 'Cache-Control', 'private, no-store')
      setHeader(event, 'X-Request-Id', mapped.meta.requestId)
      return mapped
    }
    const requestId = response.headers.get('x-request-id')
    const contentType = response.headers.get('content-type')
    if (!requestId || !contentType || !/^image\/(?:jpeg|png|webp|gif)$/.test(contentType)) {
      throw new InvalidCoreResponseError('Invalid image preview response')
    }
    const body = Buffer.from(await response.arrayBuffer())
    setResponseStatus(event, response.status)
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'X-Request-Id', requestId)
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', body.length)
    return body
  } catch (error) {
    if (!(error instanceof InvalidCoreResponseError) && import.meta.dev) {
      console.error('Admin Core image preview failed', error)
    }
    return dependencyUnavailable(event)
  }
}
