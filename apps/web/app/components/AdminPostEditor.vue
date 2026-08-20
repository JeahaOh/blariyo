<script setup lang="ts">
import type {
  AdminCommandResponse,
  AdminImageUploadResponse,
  AdminPostDetailResponse,
  AdminPostStatus,
} from '~/types/adminPost'
import {
  adminPostStatusLabel,
  commandBlocks,
  editableAdminPost,
  editorBlocks,
  idempotencyKey,
  localDateTimeValue,
  type EditorBlock,
} from '~/utils/adminPostEditor'

const props = defineProps<{
  postId: number | null
  boards: Array<{ slug: string; displayName: string }>
}>()

const emit = defineEmits<{
  changed: [postId: number]
}>()

const boardSlug = ref('meme')
const title = ref('')
const sourceName = ref('')
const sourceUrl = ref('')
const pinnedPosition = ref<string>('')
const blocks = ref<EditorBlock[]>([])
const status = ref<AdminPostStatus | null>(null)
const lockVersion = ref<number | null>(null)
const scheduledAt = ref<string | null>(null)
const publishedAt = ref<string | null>(null)
const updatedAt = ref<string | null>(null)
const scheduleAtLocal = ref(localDateTimeValue(new Date(Date.now() + 5 * 60_000)))
const loading = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const dirty = ref(false)
const message = ref('')
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const isNew = computed(() => props.postId === null)
const canEdit = computed(() => editableAdminPost(status.value))
const canSave = computed(() => canEdit.value && !loading.value && !submitting.value)
const hiddenImagesReady = computed(() => blocks.value.every(block => block.type === 'TEXT'
  || ['PRIVATE_REVIEW', 'STAGED'].includes(block.status)))

watch(
  () => props.postId,
  async postId => postId === null ? resetNewPost() : loadPost(postId),
  { immediate: true },
)

watch(
  () => props.boards,
  (boards) => {
    const firstBoard = boards[0]
    if (isNew.value && firstBoard && !boards.some(board => board.slug === boardSlug.value)) {
      boardSlug.value = firstBoard.slug
    }
  },
  { deep: true },
)

function blockKey() {
  return globalThis.crypto.randomUUID()
}

function resetFeedback() {
  message.value = ''
  errorMessage.value = ''
}

function resetNewPost() {
  resetFeedback()
  boardSlug.value = props.boards[0]?.slug || 'meme'
  title.value = ''
  sourceName.value = ''
  sourceUrl.value = ''
  pinnedPosition.value = ''
  blocks.value = [{ key: blockKey(), type: 'TEXT', text: '' }]
  status.value = null
  lockVersion.value = null
  scheduledAt.value = null
  publishedAt.value = null
  updatedAt.value = null
  scheduleAtLocal.value = localDateTimeValue(new Date(Date.now() + 5 * 60_000))
  dirty.value = false
}

async function loadPost(postId: number) {
  loading.value = true
  resetFeedback()
  try {
    const response = await $fetch<AdminPostDetailResponse>(`/api/v1/admin/posts/${postId}`)
    const post = response.data
    boardSlug.value = post.boardSlug
    title.value = post.title
    sourceName.value = post.source?.name || ''
    sourceUrl.value = post.source?.url || ''
    pinnedPosition.value = post.pinnedPosition === null ? '' : String(post.pinnedPosition)
    blocks.value = editorBlocks(post.blocks, blockKey)
    status.value = post.status
    lockVersion.value = post.lockVersion
    scheduledAt.value = post.scheduledAt
    publishedAt.value = post.publishedAt
    updatedAt.value = post.updatedAt
    scheduleAtLocal.value = post.scheduledAt
      ? localDateTimeValue(new Date(post.scheduledAt))
      : localDateTimeValue(new Date(Date.now() + 5 * 60_000))
    dirty.value = false
  } catch (error) {
    errorMessage.value = apiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function addTextBlock() {
  blocks.value.push({ key: blockKey(), type: 'TEXT', text: '' })
  dirty.value = true
}

function moveBlock(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= blocks.value.length) return
  const [block] = blocks.value.splice(index, 1)
  if (block) blocks.value.splice(target, 0, block)
  dirty.value = true
}

async function removeBlock(index: number) {
  const block = blocks.value[index]
  if (!block) return
  resetFeedback()
  if (block.type === 'IMAGE' && block.stagedInEditor) {
    try {
      await $fetch(`/api/v1/admin/images/${block.imageId}`, { method: 'DELETE' })
    } catch (error) {
      errorMessage.value = apiErrorMessage(error)
      return
    }
  }
  blocks.value.splice(index, 1)
  dirty.value = true
}

async function uploadImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length === 0) return
  resetFeedback()
  uploading.value = true
  try {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    const response = await $fetch<AdminImageUploadResponse>('/api/v1/admin/images', {
      method: 'POST',
      body: form,
    })
    for (const image of response.data.items) {
      blocks.value.push({
        key: blockKey(),
        type: 'IMAGE',
        imageId: image.imageId,
        status: image.status,
        alt: '',
        width: image.width,
        height: image.height,
        previewPath: image.previewPath,
        stagedInEditor: true,
      })
    }
    dirty.value = true
    message.value = `${response.data.items.length}개 이미지를 추가했습니다.`
  } catch (error) {
    errorMessage.value = apiErrorMessage(error)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function sourcePayload() {
  return sourceName.value.length === 0 && sourceUrl.value.length === 0
    ? null
    : { name: sourceName.value, url: sourceUrl.value }
}

function pinPayload() {
  return pinnedPosition.value === '' ? null : Number(pinnedPosition.value)
}

async function savePost() {
  resetFeedback()
  submitting.value = true
  try {
    if (isNew.value) {
      const response = await $fetch<AdminCommandResponse>('/api/v1/admin/posts', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('create-post') },
        body: {
          boardSlug: boardSlug.value,
          title: title.value,
          source: sourcePayload(),
          blocks: commandBlocks(blocks.value),
          pinnedPosition: pinPayload(),
        },
      })
      message.value = '초안을 생성했습니다.'
      emit('changed', response.data.postId)
      return
    }

    const postId = props.postId
    if (postId === null) return
    const body: Record<string, unknown> = {
      lockVersion: lockVersion.value,
      title: title.value,
      source: sourcePayload(),
      blocks: commandBlocks(blocks.value),
    }
    if (status.value !== 'HIDDEN_REVIEW') body.pinnedPosition = pinPayload()
    await $fetch<AdminCommandResponse>(`/api/v1/admin/posts/${postId}`, {
      method: 'PATCH',
      body,
    })
    message.value = '게시글을 저장했습니다.'
    await loadPost(postId)
    message.value = '게시글을 저장했습니다.'
    emit('changed', postId)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error)
  } finally {
    submitting.value = false
  }
}

async function runLifecycle(
  path: string,
  scope: string,
  body: Record<string, unknown>,
  method: 'POST' | 'DELETE' = 'POST',
) {
  if (props.postId === null) return
  resetFeedback()
  submitting.value = true
  try {
    await $fetch<AdminCommandResponse>(`/api/v1/admin/posts/${props.postId}${path}`, {
      method,
      headers: { 'Idempotency-Key': idempotencyKey(scope) },
      body,
    })
    await loadPost(props.postId)
    emit('changed', props.postId)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error)
  } finally {
    submitting.value = false
  }
}

async function publishNow() {
  await runLifecycle('/publish', 'publish-post', {
    lockVersion: lockVersion.value,
    mode: 'IMMEDIATE',
  })
  if (!errorMessage.value) message.value = '게시글을 공개했습니다.'
}

async function schedulePost() {
  const parsed = new Date(scheduleAtLocal.value)
  if (Number.isNaN(parsed.getTime())) {
    errorMessage.value = '예약 시각을 확인해 주세요.'
    return
  }
  await runLifecycle('/publish', 'schedule-post', {
    lockVersion: lockVersion.value,
    mode: 'SCHEDULED',
    scheduledAt: parsed.toISOString(),
  })
  if (!errorMessage.value) message.value = '게시글 공개를 예약했습니다.'
}

async function unschedulePost() {
  await runLifecycle('/unschedule', 'unschedule-post', { lockVersion: lockVersion.value })
  if (!errorMessage.value) message.value = '예약을 취소했습니다.'
}

async function hidePost() {
  if (!window.confirm('공개 게시글을 즉시 숨길까요?')) return
  await runLifecycle('/hide', 'hide-post', {
    lockVersion: lockVersion.value,
    reasonCode: 'RIGHTS_EMAIL',
  })
  if (!errorMessage.value) message.value = '게시글을 숨겼습니다.'
}

async function republishPost() {
  await runLifecycle('/republish', 'republish-post', {
    lockVersion: lockVersion.value,
    pinnedPosition: pinPayload(),
  })
  if (!errorMessage.value) message.value = '게시글을 재공개했습니다.'
}

async function removePost() {
  if (!window.confirm('이 게시글을 최종 삭제 상태로 전환할까요? 이 상태에서는 되돌릴 수 없습니다.')) return
  await runLifecycle('', 'remove-post', {
    lockVersion: lockVersion.value,
    reasonCode: 'RIGHTS_EMAIL',
  }, 'DELETE')
  if (!errorMessage.value) message.value = '게시글을 최종 삭제 상태로 전환했습니다.'
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value)) : '-'
}

function apiErrorMessage(error: unknown) {
  const payload = (error as {
    data?: { error?: { message?: string; fields?: Array<{ field: string; reason: string }> } }
  })?.data
  const base = payload?.error?.message || '요청을 처리하지 못했습니다.'
  const fields = payload?.error?.fields || []
  return fields.length > 0
    ? `${base} (${fields.map(field => `${field.field}: ${field.reason}`).join(', ')})`
    : base
}
</script>

<template>
  <section class="admin-editor" aria-labelledby="editor-title">
    <header class="admin-editor-header">
      <div>
        <p class="admin-eyebrow">{{ isNew ? 'NEW POST' : `POST #${postId}` }}</p>
        <h2 id="editor-title">{{ isNew ? '새 게시글 작성' : title || '게시글 편집' }}</h2>
      </div>
      <div v-if="status && postId" class="admin-editor-header-actions">
        <span class="admin-status" :data-status="status">{{ adminPostStatusLabel(status) }}</span>
        <button type="button" class="admin-button secondary compact" :disabled="loading || submitting" @click="loadPost(postId)">
          새로고침
        </button>
      </div>
    </header>

    <div v-if="loading" class="admin-editor-state">게시글을 불러오는 중입니다.</div>
    <form v-else class="admin-form" @submit.prevent="savePost">
      <fieldset
        :disabled="!canEdit || submitting"
        class="admin-fieldset"
        @input="dirty = true"
        @change="dirty = true"
      >
        <div class="admin-form-grid">
          <label class="admin-field">
            <span>게시판</span>
            <select v-model="boardSlug" :disabled="!isNew">
              <option v-for="board in boards" :key="board.slug" :value="board.slug">
                {{ board.displayName }} ({{ board.slug }})
              </option>
            </select>
          </label>
          <label class="admin-field">
            <span>공지 순서</span>
            <select v-model="pinnedPosition" :disabled="status === 'HIDDEN_REVIEW'">
              <option value="">일반 글</option>
              <option value="1">공지 1</option>
              <option value="2">공지 2</option>
              <option value="3">공지 3</option>
            </select>
          </label>
        </div>

        <label class="admin-field">
          <span>제목</span>
          <input v-model="title" maxlength="200" required placeholder="게시글 제목" />
        </label>

        <div class="admin-form-grid">
          <label class="admin-field">
            <span>출처명 <small>선택</small></span>
            <input v-model="sourceName" maxlength="200" placeholder="example.com" />
          </label>
          <label class="admin-field">
            <span>출처 URL <small>선택, HTTPS</small></span>
            <input v-model="sourceUrl" maxlength="2048" type="url" placeholder="https://example.com/original" />
          </label>
        </div>

        <section class="admin-block-section" aria-labelledby="block-heading">
          <header class="admin-block-heading">
            <div>
              <h3 id="block-heading">본문 블록</h3>
              <p>텍스트와 이미지는 위에서 아래 순서대로 노출됩니다.</p>
            </div>
            <div class="admin-block-add">
              <button type="button" class="admin-button secondary" @click="addTextBlock">텍스트 추가</button>
              <label class="admin-button secondary file-button">
                {{ uploading ? '업로드 중' : '이미지 추가' }}
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  :disabled="uploading"
                  @change="uploadImages"
                />
              </label>
            </div>
          </header>

          <p v-if="blocks.length === 0" class="admin-empty-blocks">본문 블록을 한 개 이상 추가해 주세요.</p>
          <article v-for="(block, index) in blocks" :key="block.key" class="admin-block-card">
            <header>
              <strong>{{ index + 1 }}. {{ block.type === 'TEXT' ? '텍스트' : '이미지' }}</strong>
              <div class="admin-block-controls">
                <button type="button" :disabled="index === 0" aria-label="위로 이동" @click="moveBlock(index, -1)">↑</button>
                <button type="button" :disabled="index === blocks.length - 1" aria-label="아래로 이동" @click="moveBlock(index, 1)">↓</button>
                <button type="button" class="danger-text" @click="removeBlock(index)">제거</button>
              </div>
            </header>
            <label v-if="block.type === 'TEXT'" class="admin-field">
              <span class="sr-only">텍스트 본문</span>
              <textarea v-model="block.text" maxlength="20000" rows="7" required placeholder="본문을 입력하세요." />
            </label>
            <div v-else class="admin-image-editor">
              <img :src="block.previewPath" :alt="block.alt || '업로드 이미지 미리보기'" />
              <div>
                <p>{{ block.width }} × {{ block.height }} · {{ block.status }}</p>
                <label class="admin-field">
                  <span>대체 텍스트</span>
                  <input v-model="block.alt" maxlength="300" required placeholder="이미지를 설명해 주세요." />
                </label>
              </div>
            </div>
          </article>
        </section>
      </fieldset>

      <dl v-if="!isNew" class="admin-post-dates">
        <div><dt>예약</dt><dd>{{ formatDate(scheduledAt) }}</dd></div>
        <div><dt>최초 공개</dt><dd>{{ formatDate(publishedAt) }}</dd></div>
        <div><dt>최근 수정</dt><dd>{{ formatDate(updatedAt) }}</dd></div>
        <div><dt>버전</dt><dd>{{ lockVersion }}</dd></div>
      </dl>

      <p v-if="errorMessage" class="admin-alert error" role="alert">{{ errorMessage }}</p>
      <p v-if="message" class="admin-alert success" role="status">{{ message }}</p>
      <p v-if="dirty && !isNew" class="admin-alert notice" role="status">
        상태를 변경하기 전에 수정한 내용을 저장해 주세요.
      </p>
      <p v-if="status === 'HIDDEN_REVIEW' && !hiddenImagesReady" class="admin-alert notice" role="status">
        공개 이미지 삭제가 끝난 뒤 재공개하거나 최종 삭제할 수 있습니다. 잠시 후 새로고침해 주세요.
      </p>

      <footer class="admin-editor-actions">
        <button v-if="canEdit" type="submit" class="admin-button primary" :disabled="!canSave">
          {{ submitting ? '처리 중' : isNew ? '초안 생성' : '내용 저장' }}
        </button>

        <template v-if="status === 'DRAFT' || status === 'SCHEDULED'">
          <button type="button" class="admin-button primary" :disabled="submitting || dirty" @click="publishNow">즉시 발행</button>
          <div class="admin-schedule-control">
            <input v-model="scheduleAtLocal" type="datetime-local" :disabled="submitting" />
            <button type="button" class="admin-button secondary" :disabled="submitting || dirty" @click="schedulePost">예약</button>
          </div>
        </template>
        <button v-if="status === 'SCHEDULED'" type="button" class="admin-button secondary" :disabled="submitting || dirty" @click="unschedulePost">예약 취소</button>
        <button v-if="status === 'PUBLISHED'" type="button" class="admin-button warning" :disabled="submitting" @click="hidePost">게시글 숨김</button>
        <template v-if="status === 'HIDDEN_REVIEW'">
          <button type="button" class="admin-button primary" :disabled="submitting || dirty || !hiddenImagesReady" @click="republishPost">재공개</button>
          <button type="button" class="admin-button danger" :disabled="submitting || dirty || !hiddenImagesReady" @click="removePost">최종 삭제</button>
        </template>
      </footer>
    </form>
  </section>
</template>
