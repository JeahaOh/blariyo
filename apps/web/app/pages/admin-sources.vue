<script setup lang="ts">
definePageMeta({ path: '/admin/sources' });
useHead({ title: '수집처 관리 · 블라리요' });
const requestFetch = useRequestFetch();
const { data: features, error, refresh } = await useAsyncData('source-management-features', () =>
  requestFetch<{ batchReview: boolean }>('/api/admin/features')
);
</script>
<template>
  <main class="source-management">
    <header><h1>수집처 관리</h1><p>수집처 수집 여부, 자동 발행 여부 관리.</p></header>
    <div v-if="error" role="alert">
      <p>수집처 관리 화면을 불러오지 못했습니다.</p>
      <button @click="refresh()">다시 조회</button>
    </div>
    <SourcePublishPolicies v-else-if="features?.batchReview" />
    <p v-else>수집처 관리 기능이 활성화되어 있지 않습니다.</p>
  </main>
</template>
<style scoped>
.source-management { width: 100%; max-width: 1240px; }
.source-management > header { margin-bottom: 24px; }
.source-management > header p { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
@media (max-width: 600px) { .source-management > header { margin-bottom: 18px; } }
</style>
