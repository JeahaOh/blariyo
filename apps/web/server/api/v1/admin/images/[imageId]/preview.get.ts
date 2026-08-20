import { proxyAdminImagePreview } from '../../../../../utils/adminCoreApi'
import { isAdminPostId } from '../../../../../utils/adminPostValidation'
import { publicError } from '../../../../../utils/publicErrors'

export default defineEventHandler((event): unknown => {
  const imageId = getRouterParam(event, 'imageId')
  if (!isAdminPostId(imageId)) {
    return publicError(event, 404, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.')
  }
  return proxyAdminImagePreview(event, `/internal/v1/admin/images/${imageId}/preview`)
})
