<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number } }>();
const route = useRoute();
const detail = computed(() => /^\/[^/]+\/posts\/[^/]+$/.test(route.path));
const message = computed(() => {
  if (props.error.statusCode === 401) return '관리자 인증이 필요합니다.';
  if (props.error.statusCode === 403) return '접근 권한이 없습니다.';
  if (props.error.statusCode === 404)
    return detail.value ? '볼 수 없는 게시글입니다' : '페이지를 찾을 수 없습니다.';
  return '잠시 후 다시 시도해 주세요.';
});
const retryable = computed(() => ![401, 403, 404].includes(props.error.statusCode || 500));
useSeoMeta({ robots: 'noindex, nofollow', title: () => `${message.value} · 블라리요` });
if (import.meta.server) useResponseHeader('Cache-Control').value = 'no-store';
</script>
<template>
  <div class="shell">
    <div v-if="detail" class="detail-nav">
      <a href="/meme" aria-label="목록으로">←</a><strong>{{ message }}</strong>
    </div>
    <SiteHeader v-else />
    <main id="main-content" class="state-panel">
      <h1>{{ message }}</h1>
      <p v-if="error.statusCode === 404">주소를 확인하거나 목록에서 다른 글을 찾아보세요.</p>
      <div class="state-actions">
        <button v-if="retryable" @click="clearError()">다시 시도</button
        ><a href="/meme">목록으로</a>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
