import { getRequestURL, type H3Event } from 'h3'
import { getAdminIdentityProvider } from '../utils/adminIdentityProvider'
import { isAdminPath } from '../utils/adminPath'
import { publicError } from '../utils/publicErrors'

export default defineEventHandler(async (event) => {
  if (!isAdminPath(getRequestURL(event).pathname)) return

  let principal
  try {
    principal = await getAdminIdentityProvider(event).authenticate(event)
  } catch (error) {
    if (import.meta.dev) console.error('Admin identity provider failed', error)
    return adminError(event, 503, 'ADMIN_AUTH_UNAVAILABLE', '관리자 인증을 사용할 수 없습니다.')
  }
  if (!principal) {
    return adminError(event, 401, 'ADMIN_AUTH_REQUIRED', '관리자 인증이 필요합니다.')
  }
  event.context.adminPrincipal = principal
})

function adminError(event: H3Event, status: number, code: string, message: string) {
  return publicError(event, status, code, message)
}
