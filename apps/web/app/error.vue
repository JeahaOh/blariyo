<script setup>
const props = defineProps({ error: Object });
const message = computed(() => {
  if (props.error?.statusCode === 401) return '관리자 인증이 필요합니다.';
  if (props.error?.statusCode === 403) return '접근 권한이 없습니다.';
  if (props.error?.statusCode === 404) return '페이지를 찾을 수 없습니다.';
  return '잠시 후 다시 시도해 주세요.';
});
useSeoMeta({ robots: 'noindex, nofollow', title: () => `${message.value} · 블라리요` });
if (import.meta.server) useResponseHeader('Cache-Control').value = 'no-store';
</script>
<template>
  <main>
    <h1>{{ message }}</h1>
    <a href="/meme">목록으로</a>
  </main>
</template>
