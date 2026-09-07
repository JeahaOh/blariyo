import { jwtVerify } from 'jose';
export async function verifyAccessIdentity(assertion, { issuer, audience, key, operators }) {
  const { payload } = await jwtVerify(assertion, key, {
    issuer,
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'sub', 'iat'],
  });
  const operatorId = Object.hasOwn(operators, payload.sub) ? operators[payload.sub] : undefined;
  if (typeof operatorId !== 'string' || !operatorId.trim()) {
    const error = new Error('ADMIN_FORBIDDEN');
    error.statusCode = 403;
    throw error;
  }
  return operatorId;
}
