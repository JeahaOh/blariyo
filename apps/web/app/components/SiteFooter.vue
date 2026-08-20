<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const currentUrl = computed(() => `${config.public.siteBaseUrl}${route.fullPath}`)
const rightsHref = computed(() => {
  const subject = encodeURIComponent('[블라리요] 권리 침해·게시 중단 문의')
  const body = encodeURIComponent(`대상 URL: ${currentUrl.value}\n\n요청 내용을 작성해 주세요.`)
  return `mailto:rights@__SERVICE_DOMAIN__?subject=${subject}&body=${body}`
})
</script>

<template>
  <footer class="site-footer">
    <strong>블라리요</strong>
    <nav aria-label="푸터">
      <NuxtLink to="/terms">이용약관</NuxtLink>
      <NuxtLink to="/privacy">개인정보처리방침</NuxtLink>
      <a :href="rightsHref">권리 문의</a>
      <NuxtLink to="/cookie-settings">쿠키 설정</NuxtLink>
    </nav>
  </footer>
</template>
