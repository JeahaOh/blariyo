import type { H3Event } from 'h3';
import { env } from 'node:process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet } from 'jose';
import { verifyAccessIdentity } from './access.mjs';
import { readFile } from 'node:fs/promises';
let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function adminIdentity(event: H3Event) {
  const config = useRuntimeConfig(event);
  let operatorId: string | undefined;
  if (config.adminAuthMode === 'local') {
    if (env.NODE_ENV === 'production' || !config.localAdminToken)
      throw createError({ statusCode: 401 });
    const token = getCookie(event, 'BLARIYO_ADMIN_SESSION') || '';
    if (
      Buffer.byteLength(token) !== Buffer.byteLength(config.localAdminToken) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(config.localAdminToken))
    )
      throw createError({ statusCode: 401 });
    operatorId = 'local-fixture-operator';
  } else {
    if (!config.accessIssuer || !config.accessAudience) throw createError({ statusCode: 401 });
    const assertion = getHeader(event, 'cf-access-jwt-assertion');
    if (!assertion) throw createError({ statusCode: 401 });
    try {
      keys ||= createRemoteJWKSet(new URL('/cdn-cgi/access/certs', config.accessIssuer));
      const operators: unknown = JSON.parse(await readFile(config.adminOperatorsFile, 'utf8'));
      operatorId = await verifyAccessIdentity(assertion, {
        issuer: config.accessIssuer,
        audience: config.accessAudience,
        key: keys,
        operators,
      });
    } catch (e: unknown) {
      throw createError({ statusCode: errorStatus(e) === 403 ? 403 : 401 });
    }
    if (!operatorId) throw createError({ statusCode: 403 });
  }
  if (!config.actorSecret || Buffer.byteLength(config.actorSecret) < 32)
    throw createError({ statusCode: 401 });
  return `admin:v1:${createHmac('sha256', config.actorSecret).update(operatorId).digest('base64url')}`;
}
