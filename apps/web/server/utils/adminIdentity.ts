import type { H3Event } from 'h3'

export interface AdminPrincipal {
  operatorId: string
}

export interface AdminIdentityProvider {
  authenticate(event: H3Event): Promise<AdminPrincipal | null>
}

export function isValidOperatorId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)
}

export function getAdminPrincipal(event: H3Event) {
  const principal = event.context.adminPrincipal as AdminPrincipal | undefined
  if (!principal || !isValidOperatorId(principal.operatorId)) {
    throw new Error('Authenticated admin principal is missing')
  }
  return principal
}
