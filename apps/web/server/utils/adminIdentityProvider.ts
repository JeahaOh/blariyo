import type { H3Event } from 'h3'
import type { AdminIdentityProvider } from './adminIdentity'
import { createCloudflareAccessIdentityProvider } from './cloudflareAccessIdentity'

const providers = new Map<string, AdminIdentityProvider>()

export function getAdminIdentityProvider(event: H3Event) {
  const config = useRuntimeConfig(event)
  const providerName = String(config.adminIdentityProvider || '')
  if (providerName !== 'cloudflare-access') {
    throw new Error('NUXT_ADMIN_IDENTITY_PROVIDER is unsupported')
  }

  const options = {
    audience: String(config.cloudflareAccessAudience || ''),
    teamDomain: String(config.cloudflareAccessTeamDomain || ''),
    operatorId: String(config.adminOperatorId || ''),
  }
  const key = JSON.stringify([providerName, options])
  const cached = providers.get(key)
  if (cached) return cached

  const provider = createCloudflareAccessIdentityProvider(options)
  providers.set(key, provider)
  return provider
}
