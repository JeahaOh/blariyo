<script setup lang="ts">
import type { PostContext, PostListResponse } from '~/types/publicContent'

const props = defineProps<{
  boardSlug: string
  postId: number
  initialContext: PostContext
}>()

const context = ref<PostContext>({ ...props.initialContext })
const pending = ref(false)
const failed = ref(false)
const { track } = usePublicEvent()

const pages = computed(() => {
  if (context.value.totalPages <= 0) return []
  const start = Math.max(1, Math.min(context.value.listPage - 2, context.value.totalPages - 4))
  const end = Math.min(context.value.totalPages, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

async function loadPage(page: number) {
  if (pending.value || page === context.value.listPage || page < 1 || page > context.value.totalPages) return
  pending.value = true
  failed.value = false
  try {
    const response = await $fetch<PostListResponse>(
      `/api/v1/boards/${encodeURIComponent(props.boardSlug)}/posts`,
      { query: { page } },
    )
    context.value = {
      pinnedItems: response.data.pinnedItems,
      listPage: response.meta.page,
      items: response.data.items,
      pageSize: response.meta.pageSize,
      totalItems: response.meta.totalItems,
      totalPages: response.meta.totalPages,
    }
    track({
      eventType: 'DETAIL_LIST_VIEW',
      boardSlug: props.boardSlug,
      postId: props.postId,
      listPage: response.meta.page,
      itemCount: response.data.items.length,
    })
  } catch {
    failed.value = true
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="related-list">
    <header class="section-heading">
      <div>
        <h2>짤 목록</h2>
        <p>현재 글과 같은 게시판의 글</p>
      </div>
      <NuxtLink :to="`/${boardSlug}`">전체 목록</NuxtLink>
    </header>
    <PostRows :pinned-items="context.pinnedItems" :items="context.items" />
    <p v-if="failed" class="inline-error" role="alert">목록을 불러오지 못했습니다.</p>
    <nav v-if="context.totalPages > 1" class="pagination" aria-label="상세 하단 목록 페이지 이동">
      <button
        type="button"
        class="page-link"
        :disabled="pending || context.listPage <= 1"
        aria-label="이전 페이지"
        @click="loadPage(context.listPage - 1)"
      >‹</button>
      <button
        v-for="page in pages"
        :key="page"
        type="button"
        class="page-link"
        :class="{ 'is-active': page === context.listPage }"
        :aria-current="page === context.listPage ? 'page' : undefined"
        :disabled="pending"
        @click="loadPage(page)"
      >{{ page }}</button>
      <button
        type="button"
        class="page-link"
        :disabled="pending || context.listPage >= context.totalPages"
        aria-label="다음 페이지"
        @click="loadPage(context.listPage + 1)"
      >›</button>
    </nav>
  </section>
</template>
