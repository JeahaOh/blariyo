export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  requireLocalAdminOrigin(event);
  deleteCookie(event, 'BLARIYO_ADMIN_SESSION', { path: '/', httpOnly: true, sameSite: 'strict' });
  return { authenticated: false };
});
