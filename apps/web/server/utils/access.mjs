import { jwtVerify } from 'jose';
/**
 * @param {string} assertion
 * @param {{issuer: string, audience: string, key: import('jose').JWTVerifyGetKey | CryptoKey | Uint8Array | import('node:crypto').KeyObject, operators: unknown}} options
 */
export async function verifyAccessIdentity(assertion, { issuer, audience, key, operators }) {
  const { payload } = await jwtVerify(assertion, key, {
    issuer,
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'sub', 'iat'],
  });
  const registry =
    operators && typeof operators === 'object' ? Object.fromEntries(Object.entries(operators)) : {};
  /** @type {unknown} */
  const operatorId =
    typeof payload.sub === 'string' && Object.hasOwn(registry, payload.sub)
      ? registry[payload.sub]
      : undefined;
  if (typeof operatorId !== 'string' || !operatorId.trim()) {
    const error = Object.assign(new Error('ADMIN_FORBIDDEN'), { statusCode: 403 });
    throw error;
  }
  return operatorId;
}
