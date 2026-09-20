<script setup lang="ts">
const brand = useRuntimeConfig().public;
const route = useRoute();
</script>
<template>
  <header class="site-header">
    <NuxtLink to="/meme" class="brand" :aria-label="`${brand.siteName} 홈`">
      <span class="brand-mark" aria-hidden="true">B</span><span>{{ brand.siteName }}</span>
    </NuxtLink>
  </header>
  <nav v-if="route.path === '/meme'" class="board-tabs" aria-label="게시판">
    <NuxtLink to="/meme" aria-current="page">짤</NuxtLink>
  </nav>
</template>
