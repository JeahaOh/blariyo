export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  let authenticated = false;
  try {
    await adminIdentity(event);
    authenticated = true;
  } catch {
    /* No identity or secret in the public response. */
  }
  return { authenticated, localLoginAvailable: localAdminLoginAvailable(event) };
});
