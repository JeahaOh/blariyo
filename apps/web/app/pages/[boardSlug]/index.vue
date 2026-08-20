<script setup lang="ts">
import type { PostListResponse } from '~/types/publicContent'

const route = useRoute()
const config = useRuntimeConfig()
const boardSlug = String(route.params.boardSlug)
const page = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
const endpoint = `/api/v1/boards/${encodeURIComponent(boardSlug)}/posts`

const { data, error } = await useFetch<PostListResponse>(endpoint, {
  query: { page: page || undefined },
})

if (error.value || !data.value) {
  throw createError({
    statusCode: error.value?.statusCode || 503,
    statusMessage: error.value?.statusCode === 404
      ? '게시판을 찾을 수 없습니다.'
      : '목록을 불러오지 못했습니다.',
  })
}

const response = data.value
const { track } = usePublicEvent()
const canonical = `${config.public.siteBaseUrl}/${response.data.board.slug}${response.meta.page > 1 ? `?page=${response.meta.page}` : ''}`
const description = '운영자가 고른 최신 유머를 짧게 연속 소비하는 웹 피드'

useHead({ link: [{ rel: 'canonical', href: canonical }] })
useSeoMeta({
  title: `${response.data.board.displayName} | 블라리요`,
  description,
  ogSiteName: '블라리요',
  ogLocale: 'ko_KR',
  ogType: 'website',
  ogUrl: canonical,
  ogTitle: `${response.data.board.displayName} | 블라리요`,
  ogDescription: description,
  ogImage: `${config.public.siteBaseUrl}/og/default-1200x630.jpg`,
  twitterCard: 'summary_large_image',
  twitterTitle: `${response.data.board.displayName} | 블라리요`,
  twitterDescription: description,
  twitterImage: `${config.public.siteBaseUrl}/og/default-1200x630.jpg`,
})

onMounted(() => {
  track({
    eventType: 'FEED_VIEW',
    boardSlug: response.data.board.slug,
    listPage: response.meta.page,
    itemCount: response.data.items.length,
  })
})
</script>

<template>
  <SiteHeader />
  <main class="site-shell">
    <section>
      <header class="list-heading">
        <div>
          <h1>{{ response.data.board.displayName }}</h1>
          <p>관리자가 고른 최신 게시글</p>
        </div>
        <p class="publish-cycle">하루 2회 · 회당 10~20개</p>
      </header>

      <div
        v-if="response.data.pinnedItems.length === 0 && response.data.items.length === 0"
        class="state-panel"
      >
        <h2>아직 올라온 짤이 없습니다</h2>
        <p>잠시 후 새 글을 확인해 주세요.</p>
      </div>
      <PostRows
        v-else
        :pinned-items="response.data.pinnedItems"
        :items="response.data.items"
      />
      <PageNavigation
        :current-page="response.meta.page"
        :total-pages="response.meta.totalPages"
        :path="`/${response.data.board.slug}`"
      />
    </section>
  </main>
  <SiteFooter />
</template>
