import type { H3Event } from 'h3'
import { generateKeyPair, jwtVerify, SignJWT } from 'jose'
import { describe, expect, it, vi } from 'vitest'
import { createAdminCoreHeaders } from '../server/utils/adminCoreHeaders'
import { createCloudflareAccessIdentityProvider } from '../server/utils/cloudflareAccessIdentity'
import { isAdminPath } from '../server/utils/adminPath'
import {
  normalizeTrustedHeaderName,
  selectRateLimitClientIp,
} from '../server/utils/publicEvent'

const providerOptions = {
  audience: '0123456789abcdef0123456789abcdef',
  teamDomain: 'https://blariyo.cloudflareaccess.com',
  operatorId: 'operator-1',
}

describe('admin authentication boundary', () => {
  it('Cloudflare assertion 검증 뒤 provider-neutral operatorId만 반환한다', async () => {
    const verify = vi.fn(async () => ({
      sub: 'provider-subject',
      email: 'operator@example.com',
    }))
    const provider = createCloudflareAccessIdentityProvider(providerOptions, verify)

    const principal = await provider.authenticate(eventWithHeaders({
      'cf-access-jwt-assertion': 'header.payload.signature',
    }))

    expect(verify).toHaveBeenCalledWith('header.payload.signature')
    expect(principal).toEqual({ operatorId: 'operator-1' })
  })

  it('assertion 누락·검증 실패는 인증 실패로 닫는다', async () => {
    const provider = createCloudflareAccessIdentityProvider(
      providerOptions,
      async () => { throw new TypeError('invalid assertion') },
    )
    expect(await provider.authenticate(eventWithHeaders({}))).toBeNull()
    expect(await provider.authenticate(eventWithHeaders({
      'cf-access-jwt-assertion': 'invalid',
    }))).toBeNull()
  })

  it('만료·issuer·audience가 잘못된 assertion을 거부한다', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const verify = async (token: string) => (await jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
      audience: providerOptions.audience,
      issuer: providerOptions.teamDomain,
    })).payload
    const provider = createCloudflareAccessIdentityProvider(providerOptions, verify)
    const valid = await signedAssertion(privateKey)
    const expired = await signedAssertion(privateKey, { expirationTime: '1 second ago' })
    const wrongIssuer = await signedAssertion(privateKey, { issuer: 'https://other.cloudflareaccess.com' })
    const wrongAudience = await signedAssertion(privateKey, { audience: 'wrong-audience-value' })

    expect(await provider.authenticate(eventWithAssertion(valid))).toEqual({ operatorId: 'operator-1' })
    expect(await provider.authenticate(eventWithAssertion(expired))).toBeNull()
    expect(await provider.authenticate(eventWithAssertion(wrongIssuer))).toBeNull()
    expect(await provider.authenticate(eventWithAssertion(wrongAudience))).toBeNull()
  })

  it('Cloudflare team domain과 내부 operatorId 설정을 제한한다', () => {
    expect(() => createCloudflareAccessIdentityProvider({
      ...providerOptions,
      teamDomain: 'https://example.com',
    })).toThrow('NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN is invalid')
    expect(() => createCloudflareAccessIdentityProvider({
      ...providerOptions,
      operatorId: 'Operator Email@example.com',
    })).toThrow('NUXT_ADMIN_OPERATOR_ID is invalid')
  })

  it('Core에는 서비스 토큰과 HMAC actor만 전달한다', () => {
    const headers = createAdminCoreHeaders({
      serviceToken: 'service-token-with-at-least-thirty-two-bytes',
      actorSecret: 'actor-secret-with-at-least-thirty-two-bytes',
    }, { operatorId: 'operator-1' })

    expect(headers['X-Blariyo-Service-Token'])
      .toBe('service-token-with-at-least-thirty-two-bytes')
    expect(headers['X-Blariyo-Admin-Actor']).toMatch(/^admin:v1:[A-Za-z0-9_-]{43}$/)
    expect(JSON.stringify(headers)).not.toContain('operator-1')
  })

  it('관리자 페이지와 관리자 API만 인증 경계로 분류한다', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/posts')).toBe(true)
    expect(isAdminPath('/api/v1/admin/posts')).toBe(true)
    expect(isAdminPath('/api/v1/boards')).toBe(false)
    expect(isAdminPath('/administrator')).toBe(false)
  })
})

describe('event rate-limit client IP', () => {
  it('명시적으로 신뢰한 단일 IP만 사용하고 나머지는 연결 주소로 되돌린다', () => {
    expect(normalizeTrustedHeaderName(' CF-Connecting-IP ')).toBe('cf-connecting-ip')
    expect(normalizeTrustedHeaderName('x-forwarded-for,evil')).toBe('')
    expect(selectRateLimitClientIp('127.0.0.1', '198.51.100.10')).toBe('198.51.100.10')
    expect(selectRateLimitClientIp('127.0.0.1', '198.51.100.10, 10.0.0.1')).toBe('127.0.0.1')
    expect(selectRateLimitClientIp('127.0.0.1', 'spoofed')).toBe('127.0.0.1')
  })
})

function eventWithHeaders(headers: Record<string, string>) {
  return {
    context: {},
    node: { req: { headers } },
  } as unknown as H3Event
}

function eventWithAssertion(assertion: string) {
  return eventWithHeaders({ 'cf-access-jwt-assertion': assertion })
}

async function signedAssertion(
  privateKey: CryptoKey,
  overrides: {
    audience?: string
    expirationTime?: string
    issuer?: string
  } = {},
) {
  return new SignJWT({ email: 'operator@example.com' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('provider-subject')
    .setIssuer(overrides.issuer || providerOptions.teamDomain)
    .setAudience(overrides.audience || providerOptions.audience)
    .setIssuedAt()
    .setExpirationTime(overrides.expirationTime || '5 minutes')
    .sign(privateKey)
}
