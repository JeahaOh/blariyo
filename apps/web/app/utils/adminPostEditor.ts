import type { AdminPostBlock, AdminPostStatus } from '~/types/adminPost'

export type EditorBlock =
  | { key: string; type: 'TEXT'; text: string }
  | {
      key: string
      type: 'IMAGE'
      imageId: number
      status: string
      alt: string
      width: number
      height: number
      previewPath: string
      stagedInEditor: boolean
    }

const STATUS_LABELS: Record<AdminPostStatus, string> = {
  DRAFT: '초안',
  SCHEDULED: '예약',
  PUBLISHED: '공개',
  HIDDEN_REVIEW: '숨김 검토',
  REMOVED: '최종 삭제',
}

export function adminPostStatusLabel(status: AdminPostStatus) {
  return STATUS_LABELS[status]
}

export function editableAdminPost(status: AdminPostStatus | null) {
  return status === null || ['DRAFT', 'SCHEDULED', 'HIDDEN_REVIEW'].includes(status)
}

export function editorBlocks(blocks: AdminPostBlock[], keyFactory: () => string): EditorBlock[] {
  return blocks.map((block) => block.type === 'TEXT'
    ? { key: keyFactory(), type: 'TEXT', text: block.text }
    : {
        key: keyFactory(),
        type: 'IMAGE',
        imageId: block.image.imageId,
        status: block.image.status,
        alt: block.image.alt,
        width: block.image.width,
        height: block.image.height,
        previewPath: block.image.previewPath,
        stagedInEditor: false,
      })
}

export function commandBlocks(blocks: EditorBlock[]) {
  return blocks.map(block => block.type === 'TEXT'
    ? { type: 'TEXT' as const, text: block.text }
    : { type: 'IMAGE' as const, imageId: block.imageId, alt: block.alt })
}

export function idempotencyKey(scope: string) {
  return `${scope}-${globalThis.crypto.randomUUID()}`
}

export function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
