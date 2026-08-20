export interface RequestMeta {
  requestId: string
}

export interface PaginationMeta extends RequestMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

export interface BoardSummary {
  slug: string
  displayName: string
}

export interface PostListItem {
  postId: number
  title: string
  viewCount: number
  authorLabel: string
  publishedAt: string
  path: string
  current?: boolean
}

export interface PostListResponse {
  success: true
  data: {
    board: BoardSummary
    pinnedItems: PostListItem[]
    items: PostListItem[]
  }
  meta: PaginationMeta
}

export type PostBlock =
  | { type: 'TEXT'; text: string }
  | {
      type: 'IMAGE'
      image: { url: string; alt: string; width: number; height: number }
    }

export interface PostContext {
  pinnedItems: PostListItem[]
  listPage: number
  items: PostListItem[]
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface PostDetailResponse {
  success: true
  data: {
    post: {
      postId: number
      board: BoardSummary
      title: string
      authorLabel: string
      publishedAt: string
      viewCount: number
      blocks: PostBlock[]
      source: { name: string; url: string } | null
      shareUrl: string
    }
    context: PostContext
  }
  meta: RequestMeta
}
