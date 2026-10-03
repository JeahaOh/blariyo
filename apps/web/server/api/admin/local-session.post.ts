export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  requireLocalAdminOrigin(event);
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415 });
  setCookie(event, 'BLARIYO_ADMIN_SESSION', useRuntimeConfig(event).localAdminToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  return { authenticated: true };
});
