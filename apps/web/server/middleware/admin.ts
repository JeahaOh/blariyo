export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  if (path === '/admin' || path.startsWith('/admin/')) {
    setHeader(event, 'Cache-Control', 'private, no-store');
    try {
      await adminIdentity(event);
    } catch (e: any) {
      throw createError({ statusCode: e.statusCode || 401, message: '관리자 인증이 필요합니다.' });
    }
  }
});
