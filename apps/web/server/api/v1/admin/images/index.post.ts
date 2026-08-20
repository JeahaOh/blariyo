import { proxyAdminJson } from '../../../../utils/adminCoreApi'
import { mapAdminImageUploadResponse } from '../../../../utils/adminPostMapping'
import { publicError } from '../../../../utils/publicErrors'

const MAX_MULTIPART_SIZE = 101 * 1024 * 1024

export default defineEventHandler(async (event): Promise<unknown> => {
  const contentType = getHeader(event, 'content-type')
  if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) {
    return publicError(event, 415, 'UNSUPPORTED_MEDIA_TYPE', '지원하지 않는 파일 형식입니다.')
  }
  const contentLength = Number(getHeader(event, 'content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_SIZE) {
    return publicError(event, 413, 'UPLOAD_TOO_LARGE', '업로드 크기를 줄여 주세요.')
  }
  let body: Buffer | undefined
  try {
    body = await readRawBody(event, false)
  } catch {
    return publicError(
      event,
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      [{ field: 'files', reason: 'invalidMultipart' }],
    )
  }
  if (!body || body.length > MAX_MULTIPART_SIZE) {
    return publicError(event, 413, 'UPLOAD_TOO_LARGE', '업로드 크기를 줄여 주세요.')
  }
  return proxyAdminJson(event, {
    path: '/internal/v1/admin/images',
    method: 'POST',
    body,
    headers: { 'Content-Type': contentType },
    mapSuccess: mapAdminImageUploadResponse,
  })
})
