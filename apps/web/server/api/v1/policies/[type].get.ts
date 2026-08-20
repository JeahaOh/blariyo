import { mapPolicyResponse } from '../../../utils/publicPolicyMapping'
import { proxyPublicGet } from '../../../utils/coreApi'
import { policyNotFound } from '../../../utils/publicErrors'

const POLICY_TYPES = new Set(['terms', 'privacy'])
const VERSION_PATTERN = /^v[0-9]+(?:\.[0-9]+)*$/

export default defineEventHandler((event) => {
  const type = getRouterParam(event, 'type') || ''
  const query = getQuery(event)
  const version = query.version
  if (
    !POLICY_TYPES.has(type)
    || Array.isArray(version)
    || (version !== undefined
      && (typeof version !== 'string' || version.length > 20 || !VERSION_PATTERN.test(version)))
  ) {
    return policyNotFound(event)
  }
  const queryString = version === undefined ? '' : `?version=${encodeURIComponent(version)}`
  return proxyPublicGet(event, {
    path: `/internal/v1/policies/${encodeURIComponent(type)}${queryString}`,
    cacheControl: 'public, max-age=60, s-maxage=300',
    mapSuccess: mapPolicyResponse,
  })
})
