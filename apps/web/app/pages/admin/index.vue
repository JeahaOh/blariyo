<script setup lang="ts">
import type {
  AdminPostListItem,
  AdminPostListResponse,
  AdminPostStatus,
  BoardListResponse,
} from '~/types/adminPost'
import { adminPostStatusLabel } from '~/utils/adminPostEditor'

useSeoMeta({
  title: '게시글 관리 | 블라리요',
  robots: 'noindex, nofollow',
})

const statuses: Array<{ value: '' | AdminPostStatus; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'DRAFT', label: '초안' },
  { value: 'SCHEDULED', label: '예약' },
  { value: 'PUBLISHED', label: '공개' },
  { value: 'HIDDEN_REVIEW', label: '숨김 검토' },
  { value: 'REMOVED', label: '최종 삭제' },
]

const boards = ref<Array<{ slug: string; displayName: string }>>([])
const posts = ref<AdminPostListItem[]>([])
const selectedPostId = ref<number | null>(null)
const editorRevision = ref(0)
const statusFilter = ref<'' | AdminPostStatus>('')
const boardFilter = ref('')
const titlePrefix = ref('')
const page = ref(1)
const totalPages = ref(0)
const totalItems = ref(0)
const hasPrevious = ref(false)
const hasNext = ref(false)
const loading = ref(false)
const listError = ref('')

onMounted(async () => {
  await Promise.all([loadBoards(), loadPosts()])
})

async function loadBoards() {
  try {
    const response = await $fetch<BoardListResponse>('/api/v1/boards')
    boards.value = response.data.items.map(({ slug, displayName }) => ({ slug, displayName }))
  } catch {
    listError.value = '게시판 목록을 불러오지 못했습니다.'
  }
}

async function loadPosts() {
  loading.value = true
  listError.value = ''
  try {
    const response = await $fetch<AdminPostListResponse>('/api/v1/admin/posts', {
      query: {
        status: statusFilter.value || undefined,
        board: boardFilter.value || undefined,
        titlePrefix: titlePrefix.value.trim() || undefined,
        page: page.value,
      },
    })
    posts.value = response.data.items
    totalPages.value = response.meta.totalPages
    totalItems.value = response.meta.totalItems
    hasPrevious.value = response.meta.hasPrevious
    hasNext.value = response.meta.hasNext
  } catch (error) {
    listError.value = apiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function searchPosts() {
  page.value = 1
  await loadPosts()
}

async function changePage(nextPage: number) {
  if (nextPage < 1 || (totalPages.value > 0 && nextPage > totalPages.value)) return
  page.value = nextPage
  await loadPosts()
}

function selectPost(postId: number) {
  selectedPostId.value = postId
  editorRevision.value += 1
}

function createPost() {
  selectedPostId.value = null
  editorRevision.value += 1
}

async function handleChanged(postId: number) {
  selectedPostId.value = postId
  editorRevision.value += 1
  await loadPosts()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function apiErrorMessage(error: unknown) {
  return (error as { data?: { error?: { message?: string } } })?.data?.error?.message
    || '게시글 목록을 불러오지 못했습니다.'
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-topbar">
      <div>
        <NuxtLink class="admin-brand" to="/admin">블라리요 운영</NuxtLink>
        <span>게시글 관리</span>
      </div>
      <NuxtLink class="admin-public-link" to="/meme" target="_blank">공개 화면 ↗</NuxtLink>
    </header>

    <main class="admin-layout">
      <aside class="admin-list-panel" aria-labelledby="admin-list-title">
        <header class="admin-list-header">
          <div>
            <p class="admin-eyebrow">CONTENT</p>
            <h1 id="admin-list-title">게시글</h1>
          </div>
          <button type="button" class="admin-button primary compact" @click="createPost">새 글</button>
        </header>

        <form class="admin-search" @submit.prevent="searchPosts">
          <div class="admin-search-row">
            <select v-model="statusFilter" aria-label="게시 상태">
              <option v-for="item in statuses" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
            <select v-model="boardFilter" aria-label="게시판">
              <option value="">전체 게시판</option>
              <option v-for="board in boards" :key="board.slug" :value="board.slug">{{ board.displayName }}</option>
            </select>
          </div>
          <div class="admin-search-keyword">
            <input v-model="titlePrefix" maxlength="100" placeholder="제목 앞부분 검색" aria-label="제목 앞부분" />
            <button type="submit" class="admin-button secondary compact">검색</button>
          </div>
        </form>

        <p class="admin-list-count">총 {{ totalItems.toLocaleString('ko-KR') }}건</p>
        <p v-if="listError" class="admin-alert error" role="alert">{{ listError }}</p>
        <div v-if="loading" class="admin-list-state">목록을 불러오는 중입니다.</div>
        <div v-else-if="posts.length === 0" class="admin-list-state">조건에 맞는 게시글이 없습니다.</div>
        <ul v-else class="admin-post-list">
          <li v-for="post in posts" :key="post.postId">
            <button
              type="button"
              :class="['admin-post-item', { selected: selectedPostId === post.postId }]"
              @click="selectPost(post.postId)"
            >
              <span class="admin-post-item-top">
                <span class="admin-status" :data-status="post.status">{{ adminPostStatusLabel(post.status) }}</span>
                <span>#{{ post.postId }}</span>
                <time :datetime="post.updatedAt">{{ formatDate(post.updatedAt) }}</time>
              </span>
              <strong>{{ post.title }}</strong>
              <span class="admin-post-item-bottom">{{ post.boardSlug }} · v{{ post.lockVersion }}</span>
            </button>
          </li>
        </ul>

        <nav class="admin-list-pagination" aria-label="관리자 게시글 페이지">
          <button type="button" :disabled="!hasPrevious || loading" @click="changePage(page - 1)">이전</button>
          <span>{{ page }} / {{ Math.max(totalPages, 1) }}</span>
          <button type="button" :disabled="!hasNext || loading" @click="changePage(page + 1)">다음</button>
        </nav>
      </aside>

      <AdminPostEditor
        :key="`${selectedPostId ?? 'new'}-${editorRevision}`"
        :post-id="selectedPostId"
        :boards="boards"
        @changed="handleChanged"
      />
    </main>
  </div>
</template>
