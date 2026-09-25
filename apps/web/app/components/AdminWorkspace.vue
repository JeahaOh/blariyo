<script setup lang="ts">
const route = useRoute();
const requestFetch = useRequestFetch();
const { data: features } = await useAsyncData('workspace-admin-features', () =>
  requestFetch<{ batchReview: boolean }>('/api/admin/features').catch(() => null)
);
const { data: session } = await useAsyncData(
  'workspace-admin-session',
  () =>
    requestFetch<{ authenticated: boolean; localLoginAvailable: boolean }>(
      '/api/admin/session'
    ).catch(() => null),
  { server: false }
);
const titles: Record<string, string> = {
  '/admin': '게시글 관리',
  '/admin/batch': '수집 결과 검수',
  '/admin/collect': '수집 요청',
  '/admin/collect/sources': '수집 출처',
};
const title = computed(() => titles[route.path] || '관리자');
const sessionUrl = computed(() => '/admin/login?returnTo=' + encodeURIComponent(route.fullPath));
</script>
<template>
  <div class="admin-workspace">
    <a class="admin-skip" href="#main-content">관리 화면으로 건너뛰기</a>
    <aside class="admin-sidebar" aria-label="관리자 메뉴">
      <NuxtLink to="/admin" class="admin-wordmark"
        ><span>B</span> 블라리요 <small>관리</small></NuxtLink
      >
      <p class="admin-menu-label">작업 공간</p>
      <nav class="admin-menu" aria-label="관리 메뉴">
        <NuxtLink to="/admin" :aria-current="route.path === '/admin' ? 'page' : undefined"
          ><span aria-hidden="true">▤</span> 게시글 관리</NuxtLink
        >
        <NuxtLink
          v-if="features?.batchReview"
          to="/admin/batch"
          :aria-current="route.path === '/admin/batch' ? 'page' : undefined"
          ><span aria-hidden="true">◎</span> 수집 결과 검수</NuxtLink
        >
      </nav>
      <div class="admin-sidebar-bottom"><NuxtLink to="/meme">↗ 공개 사이트 보기</NuxtLink></div>
    </aside>
    <div class="admin-main-column">
      <header class="admin-topbar">
        <div>
          <span class="admin-topbar-kicker">BLARIYO / ADMIN</span><strong>{{ title }}</strong>
        </div>
        <div class="admin-account">
          <span class="admin-online"
            ><i /> {{ session?.localLoginAvailable ? '로컬 개발' : '인증됨' }}</span
          ><NuxtLink :to="sessionUrl">
            {{ session?.localLoginAvailable ? '세션 관리' : '인증' }}
          </NuxtLink>
        </div>
      </header>
      <div id="main-content" class="admin-content"><slot /></div>
    </div>
  </div>
</template>
