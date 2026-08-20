import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import { isValidOperatorId, type AdminPrincipal } from './adminIdentity'

interface AdminCoreSecrets {
  serviceToken: unknown
  actorSecret: unknown
}

function requiredSecret(value: unknown, name: string) {
  if (typeof value !== 'string' || Buffer.byteLength(value) < 32) {
    throw new Error(`${name} must be at least 32 bytes`)
  }
  return value
}

export function buildAdminCoreHeaders(event: H3Event, principal: AdminPrincipal) {
  const config = useRuntimeConfig(event)
  return createAdminCoreHeaders(
    {
      serviceToken: config.coreServiceToken,
      actorSecret: config.adminActorHmacSecret,
    },
    principal,
  )
}

export function createAdminCoreHeaders(secrets: AdminCoreSecrets, principal: AdminPrincipal) {
  if (!isValidOperatorId(principal.operatorId)) {
    throw new Error('Admin principal operatorId is invalid')
  }
  const serviceToken = requiredSecret(secrets.serviceToken, 'NUXT_CORE_SERVICE_TOKEN')
  const actorSecret = requiredSecret(secrets.actorSecret, 'NUXT_ADMIN_ACTOR_HMAC_SECRET')
  const actorDigest = createHmac('sha256', actorSecret)
    .update(`operator:${principal.operatorId}`)
    .digest('base64url')

  return {
    'X-Blariyo-Service-Token': serviceToken,
    'X-Blariyo-Admin-Actor': `admin:v1:${actorDigest}`,
  }
}
