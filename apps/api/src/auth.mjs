import { timingSafeEqual } from 'node:crypto';
import { fail } from './http.mjs';
export function authenticateCore(req, token) {
  const given = req.get('X-Blariyo-Service-Token') || '';
  if (
    !token ||
    Buffer.byteLength(token) < 32 ||
    Buffer.byteLength(given) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(token))
  )
    fail(401, 'ADMIN_AUTH_REQUIRED');
  const actor = req.get('X-Blariyo-Admin-Actor') || '';
  if (!/^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$/.test(actor)) fail(403, 'ADMIN_FORBIDDEN');
  return actor;
}
