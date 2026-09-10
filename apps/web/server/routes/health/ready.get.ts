import { env } from 'node:process';
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  try {
    if (env.NODE_ENV === 'production') await adminIdentity(event);
    const response = await fetch(`${useRuntimeConfig(event).coreOrigin}/internal/health/ready`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'status' in body && body.status === 'READY')
        return { status: 'READY' };
    }
  } catch {}
  setResponseStatus(event, 503);
  return { status: 'NOT_READY' };
});
