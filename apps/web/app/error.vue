<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; statusMessage?: string } }>()
const isNotFound = computed(() => props.error.statusCode === 404)

if (import.meta.server) {
  const event = useRequestEvent()
  if (event) setResponseHeader(event, 'Cache-Control', 'no-store')
}

useHead({
  title: isNotFound.value ? '볼 수 없는 게시글입니다 | 블라리요' : '일시적인 오류 | 블라리요',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <SiteHeader detail-title="볼 수 없는 게시글입니다" board-path="/meme" />
  <main class="site-shell">
    <section class="state-panel">
      <h1>{{ isNotFound ? '볼 수 없는 게시글입니다' : '페이지를 불러오지 못했습니다' }}</h1>
      <p v-if="isNotFound">존재하지 않거나 현재 공개되지 않은 게시글입니다.</p>
      <p v-else>잠시 후 다시 시도해 주세요.</p>
      <NuxtLink class="state-action" to="/meme">짤 목록으로</NuxtLink>
    </section>
  </main>
  <SiteFooter />
</template>
