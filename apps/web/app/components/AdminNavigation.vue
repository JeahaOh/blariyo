<script setup lang="ts">
const route = useRoute();
const requestFetch = useRequestFetch();
const { data: features } = await useAsyncData('admin-features', () =>
  requestFetch<{ batchReview: boolean }>('/api/admin/features').catch(() => null)
);
</script>
<template>
  <nav aria-label="관리 메뉴" class="admin-navigation">
    <NuxtLink to="/admin" :aria-current="route.path === '/admin' ? 'page' : undefined"
      >게시글 관리</NuxtLink
    >
    <NuxtLink
      v-if="features?.batchReview"
      to="/admin/batch"
      :aria-current="route.path === '/admin/batch' ? 'page' : undefined"
      >수집 결과 검수</NuxtLink
    >
    <NuxtLink to="/meme">공개 목록</NuxtLink>
  </nav>
</template>
<style scoped>
.admin-navigation {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-block: 16px;
}
[aria-current='page'] {
  font-weight: 700;
}
</style>
