import type { H3Event } from 'h3';
import { env } from 'node:process';

/** Explicit development opt-in. A proxy or a forged forwarded address never enables it. */
export function localAdminLoginAvailable(event: H3Event): boolean {
  const config = useRuntimeConfig(event);
  if (
    env.NODE_ENV === 'production' ||
    ![true, 'true'].includes(config.localAdminLoginEnabled) ||
    config.adminAuthMode !== 'local' ||
    !/^[a-f0-9]{64}$/.test(config.localAdminToken) ||
    !config.actorSecret ||
    Buffer.byteLength(config.actorSecret) < 32
  )
    return false;
  if (
    [
      'forwarded',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'cf-connecting-ip',
    ].some((name) => getHeader(event, name))
  )
    return false;
  const peer = event.node.req.socket.remoteAddress;
  if (!peer || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) return false;
  try {
    const site = new URL(config.public.siteOrigin);
    return (
      site.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname) &&
      !site.username &&
      !site.password &&
      getHeader(event, 'host') === site.host
    );
  } catch {
    return false;
  }
}

export function requireLocalAdminOrigin(event: H3Event) {
  if (!localAdminLoginAvailable(event)) throw createError({ statusCode: 404 });
  const origin = new URL(useRuntimeConfig(event).public.siteOrigin).origin;
  if (getHeader(event, 'origin') !== origin || getHeader(event, 'sec-fetch-site') === 'cross-site')
    throw createError({ statusCode: 403, message: '현재 개발 사이트에서 다시 시도해 주세요.' });
}
