<script setup lang="ts">
import type { ApiResponse } from '~~/shared/api-types';
const route = useRoute();
const { $analytics } = useNuxtApp();
const { data, error, status, refresh } = await useFetch<ApiResponse<'listPosts'>>(
  () => `/api/v1/boards/${String(route.params.boardSlug)}/posts`,
  { query: computed(() => ({ page: route.query.page || 1 })) }
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    statusMessage: '게시판을 불러올 수 없습니다.',
  });
const brand = useRuntimeConfig().public;
const canonical = computed(
  () => new URL('/' + String(route.params.boardSlug), brand.siteOrigin).href
);
useSeoMeta({
  title: brand.homeTitle,
  description: brand.homeDescription,
  ogTitle: brand.siteName,
  ogDescription: brand.homeOgDescription,
  ogSiteName: brand.siteName,
  ogUrl: canonical,
  ogType: 'website',
  ogImage: new URL('/og/blariyo-default.png', brand.siteOrigin).href,
  twitterCard: 'summary_large_image',
  twitterTitle: brand.siteName,
  twitterDescription: brand.homeOgDescription,
  twitterImage: new URL('/og/blariyo-default.png', brand.siteOrigin).href,
});
useHead({ link: [{ rel: 'canonical', href: canonical }] });
if (import.meta.server) useResponseHeader('Cache-Control').value = 'no-store';
function changePage(page: number) {
  const current = data.value?.meta.page || Number(route.query.page || 1);
  $analytics?.send('list_page_change', {
    board_slug: String(route.params.boardSlug),
    from_list_page: current,
    to_list_page: page,
    list_kind: 'regular',
  });
  return navigateTo({ query: { page } });
}
</script>
<template>
  <main class="board-page">
    <div class="list-heading">
      <div>
        <h1>{{ data?.data.board.displayName }}</h1>
        <p>{{ brand.homeTagline }}</p>
      </div>
      <p v-if="data" class="list-summary">최신순 · {{ data.meta.page }}쪽</p>
    </div>
    <ListSkeleton v-if="status === 'pending'" />
    <section v-else-if="error" class="empty" role="alert">
      <p>목록을 불러오지 못했습니다.</p>
      <button @click="refresh()">다시 시도</button>
    </section>
    <PostList v-else-if="data" v-bind="data.data" :list-page="data.meta.page" /><PageNumbers
      v-if="data && !error && status !== 'pending'"
      :page="data.meta.page"
      :total="data.meta.totalPages"
      @change="changePage"
    />
  </main>
</template>
