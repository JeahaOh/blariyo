<script setup lang="ts">
const route = useRoute();
const detail = computed(() => /^\/[^/]+\/posts\/[^/]+$/.test(route.path));
</script>
<template>
  <div class="shell" :class="{ 'admin-shell': route.path.startsWith('/admin') }">
    <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <SiteHeader v-if="!detail" />
    <NuxtPage id="main-content" /><SiteFooter />
  </div>
</template>
