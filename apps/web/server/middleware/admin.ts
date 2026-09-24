export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  if (
    path.startsWith('/admin') ||
    path.startsWith('/api/') ||
    path.startsWith('/internal') ||
    path.startsWith('/health/') ||
    path.startsWith('/__gateway_health')
  )
    setHeader(event, 'X-Robots-Tag', 'noindex');
  if (path === '/admin' || path.startsWith('/admin/')) {
    setHeader(event, 'Cache-Control', 'private, no-store');
    try {
      await adminIdentity(event);
    } catch (e: unknown) {
      throw createError({
        statusCode: errorStatus(e) || 401,
        message: '관리자 인증이 필요합니다.',
      });
    }
  }
});
