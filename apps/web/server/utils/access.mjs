import { jwtVerify } from 'jose';
/** @typedef {{operatorId: string, role: 'OWNER' | 'EDITOR'}} AdminOperator */
/** @param {unknown} value
 * @returns {value is string}
 */
function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}
/**
 * Validate every entry before granting access; malformed or duplicate identities fail closed.
 * @param {unknown} operators
 * @returns {Map<string, AdminOperator>}
 */
export function parseAdminOperators(operators) {
  const invalid = () => Object.assign(new Error('ADMIN_OPERATORS_INVALID'), { statusCode: 403 });
  if (!Array.isArray(operators)) throw invalid();
  /** @type {unknown[]} */
  const entries = operators;
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Set<string>} */
  const operatorIds = new Set();
  /** @type {Map<string, AdminOperator>} */
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
      !('role' in entry) ||
      !Object.hasOwn(entry, 'role') ||
      (entry.role !== 'OWNER' && entry.role !== 'EDITOR') ||
      !nonEmptyString(entry.identity) ||
      !nonEmptyString(entry.operatorId) ||
      typeof entry.active !== 'boolean' ||
      seen.has(entry.identity) ||
      operatorIds.has(entry.operatorId)
    )
      throw invalid();
    seen.add(entry.identity);
    operatorIds.add(entry.operatorId);
    if (entry.active === true) active.set(entry.identity, { operatorId: entry.operatorId, role: entry.role });
  }
  return active;
}
/**
 * @param {string} assertion
 * @param {{issuer: string, audience: string, key: import('jose').JWTVerifyGetKey | CryptoKey | Uint8Array | import('node:crypto').KeyObject, operators: unknown}} options
 */
export async function verifyAccessOperator(assertion, { issuer, audience, key, operators }) {
  const { payload } = await jwtVerify(assertion, key, {
    issuer,
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'sub', 'iat'],
  });
  const registry = parseAdminOperators(operators);
  // Cloudflare Access uses the JWT subject as the stable app identity.
  // In get-identity output this corresponds to user_uuid, not email or id.
  const operator = typeof payload.sub === 'string' ? registry.get(payload.sub) : undefined;
  if (!operator) {
    const error = Object.assign(new Error('ADMIN_FORBIDDEN'), { statusCode: 403 });
    throw error;
  }
  return operator;
}
/**
 * Identity-only compatibility helper. The registry still requires an explicit role.
 * @param {string} assertion
 * @param {Parameters<typeof verifyAccessOperator>[1]} options
 */
export async function verifyAccessIdentity(assertion, options) {
  return (await verifyAccessOperator(assertion, options)).operatorId;
}
