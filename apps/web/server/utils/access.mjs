import { jwtVerify } from 'jose';
/** @param {unknown} value
 * @returns {value is string}
 */
function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}
/**
 * Validate every entry before granting access; malformed or duplicate identities fail closed.
 * @param {unknown} operators
 * @returns {Map<string, string>}
 */
export function parseAdminOperators(operators) {
  const invalid = () => Object.assign(new Error('ADMIN_OPERATORS_INVALID'), { statusCode: 403 });
  if (!Array.isArray(operators)) throw invalid();
  /** @type {unknown[]} */
  const entries = operators;
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Map<string, string>} */
  const active = new Map();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      !('identity' in entry) ||
      !('operatorId' in entry) ||
      !('active' in entry) ||
      !Object.hasOwn(entry, 'identity') ||
      !Object.hasOwn(entry, 'operatorId') ||
      !Object.hasOwn(entry, 'active') ||
      !nonEmptyString(entry.identity) ||
      !nonEmptyString(entry.operatorId) ||
      typeof entry.active !== 'boolean' ||
      seen.has(entry.identity)
    )
      throw invalid();
    seen.add(entry.identity);
    if (entry.active === true) active.set(entry.identity, entry.operatorId);
  }
  return active;
}
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
  const registry = parseAdminOperators(operators);
  const operatorId = typeof payload.sub === 'string' ? registry.get(payload.sub) : undefined;
  if (!operatorId) {
    const error = Object.assign(new Error('ADMIN_FORBIDDEN'), { statusCode: 403 });
    throw error;
  }
  return operatorId;
}
