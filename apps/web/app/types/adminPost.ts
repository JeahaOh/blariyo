export type AdminPostStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'HIDDEN_REVIEW'
  | 'REMOVED'

export type AdminImageStatus =
  | 'STAGED'
  | 'PUBLIC'
  | 'PUBLIC_DELETE_PENDING'
  | 'PRIVATE_REVIEW'
  | 'PRIVATE_DELETE_PENDING'
  | 'DELETED'

export interface AdminPostListItem {
  postId: number
  boardSlug: string
  title: string
  status: AdminPostStatus
  lockVersion: number
  scheduledAt: string | null
  publishedAt: string | null
  updatedAt: string
}

export interface AdminPostListResponse {
  success: true
  data: { items: AdminPostListItem[] }
  meta: {
    requestId: string
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasPrevious: boolean
    hasNext: boolean
  }
}

export type AdminPostBlock =
  | { type: 'TEXT'; text: string }
  | {
      type: 'IMAGE'
      image: {
        imageId: number
        status: AdminImageStatus
        alt: string
        width: number
        height: number
        previewPath: string
      }
    }

export interface AdminPostDetail {
  postId: number
  boardSlug: string
  title: string
  source: { name: string; url: string } | null
  blocks: AdminPostBlock[]
  pinnedPosition: number | null
  status: AdminPostStatus
  scheduledAt: string | null
  publishedAt: string | null
  lockVersion: number
  createdAt: string
  updatedAt: string
}

export interface AdminPostDetailResponse {
  success: true
  data: AdminPostDetail
  meta: { requestId: string }
}

export interface AdminCommandResponse {
  success: true
  data: {
    postId: number
    status: AdminPostStatus
    lockVersion: number
    updatedAt?: string
    publishedAt?: string | null
    scheduledAt?: string | null
  }
  meta: { requestId: string }
}

export interface AdminImageUploadResponse {
  success: true
  data: {
    items: Array<{
      imageId: number
      status: AdminImageStatus
      mimeType: string
      byteSize: number
      width: number
      height: number
      previewPath: string
    }>
  }
  meta: { requestId: string }
}

export interface BoardListResponse {
  success: true
  data: {
    items: Array<{
      slug: string
      displayName: string
      postingPolicy: string
      path: string
    }>
  }
  meta: { requestId: string }
}
