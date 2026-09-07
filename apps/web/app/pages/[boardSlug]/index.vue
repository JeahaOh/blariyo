<script setup>
const route = useRoute();
const { data, error, status } = await useFetch(
  () => `/api/v1/boards/${route.params.boardSlug}/posts`,
  { query: computed(() => ({ page: route.query.page || 1 })) }
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    statusMessage: '게시판을 불러올 수 없습니다.',
  });
const brand = useRuntimeConfig().public;
const canonical = computed(() => new URL('/' + route.params.boardSlug, brand.siteOrigin).href);
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
  <main>
    <h1>{{ data?.data.board.displayName }}</h1>
    <p v-if="status === 'pending'" role="status">불러오는 중입니다.</p>
    <PostList v-if="data" v-bind="data.data" /><PageNumbers
      v-if="data"
      :page="data.meta.page"
      :total="data.meta.totalPages"
      @change="(n) => navigateTo({ query: { page: n } })"
    />
  </main>
</template>
