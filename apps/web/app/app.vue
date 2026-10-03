<script setup lang="ts">
const route = useRoute();
const detail = computed(() => /^\/[^/]+\/posts\/[^/]+$/.test(route.path));
</script>
<template>
  <AdminWorkspace v-if="route.path.startsWith('/admin') && route.path !== '/admin/login'">
    <NuxtPage id="main-content" />
  </AdminWorkspace>
  <div v-else-if="route.path === '/admin/login'" class="admin-login-shell">
    <NuxtPage id="main-content" />
  </div>
  <div v-else class="shell">
    <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <SiteHeader v-if="!detail" />
    <NuxtPage id="main-content" /><SiteFooter />
  </div>
</template>
