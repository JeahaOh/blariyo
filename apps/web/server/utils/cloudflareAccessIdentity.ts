import { getCookie, getHeader, type H3Event } from 'h3'
import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
} from 'jose'
import {
  isValidOperatorId,
  type AdminIdentityProvider,
} from './adminIdentity'

const MAX_ASSERTION_LENGTH = 16_384

export interface CloudflareAccessIdentityOptions {
  audience: string
  teamDomain: string
  operatorId: string
}

export type CloudflareAccessTokenVerifier = (token: string) => Promise<JWTPayload>

export function createCloudflareAccessIdentityProvider(
  options: CloudflareAccessIdentityOptions,
  verifier?: CloudflareAccessTokenVerifier,
): AdminIdentityProvider {
  const audience = requiredAudience(options.audience)
  const issuer = requiredTeamDomain(options.teamDomain)
  if (!isValidOperatorId(options.operatorId)) {
    throw new Error('NUXT_ADMIN_OPERATOR_ID is invalid')
  }

  const verify = verifier || createVerifier(issuer, audience)
  return {
    async authenticate(event: H3Event) {
      const assertion = getHeader(event, 'cf-access-jwt-assertion')
        || getCookie(event, 'CF_Authorization')
      if (!assertion || assertion.length > MAX_ASSERTION_LENGTH) return null

      try {
        const payload = await verify(assertion)
        if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null
        return { operatorId: options.operatorId }
      } catch (error) {
        if (error instanceof joseErrors.JOSEError || error instanceof TypeError) return null
        throw error
      }
    },
  }
}

function createVerifier(issuer: string, audience: string): CloudflareAccessTokenVerifier {
  const jwks = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', `${issuer}/`))
  return async (token) => {
    const result = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      audience,
      issuer,
    })
    return result.payload
  }
}

function requiredAudience(value: unknown) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 256) {
    throw new Error('NUXT_CLOUDFLARE_ACCESS_AUDIENCE is invalid')
  }
  return value
}

function requiredTeamDomain(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN is invalid')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN is invalid')
  }
  if (
    url.protocol !== 'https:'
    || !url.hostname.endsWith('.cloudflareaccess.com')
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    throw new Error('NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN is invalid')
  }
  return url.origin
}
