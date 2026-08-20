export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const config = useRuntimeConfig(event)
  const timeout = Number(config.coreApiTimeoutMs)

  try {
    const response = await $fetch.raw<{ status?: string }>('/internal/health/ready', {
      baseURL: String(config.coreApiBaseUrl),
      ignoreResponseError: true,
      retry: 0,
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 3000,
    })
    if (response.status === 200 && response._data?.status === 'READY') {
      return { status: 'READY' }
    }
  } catch {
    // Readiness는 내부 장애 원인을 외부에 노출하지 않는다.
  }

  setResponseStatus(event, 503)
  return { status: 'NOT_READY' }
})
