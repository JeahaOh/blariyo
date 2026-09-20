<script setup lang="ts">
import type { ApiResponse } from '~~/shared/api-types';
const route = useRoute();
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
    <PostList v-else-if="data" v-bind="data.data" /><PageNumbers
      v-if="data && !error && status !== 'pending'"
      :page="data.meta.page"
      :total="data.meta.totalPages"
      @change="(n) => navigateTo({ query: { page: n } })"
    />
  </main>
</template>
