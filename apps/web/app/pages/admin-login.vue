<script setup lang="ts">
import { adminReturnPath } from '~~/shared/admin-return';
definePageMeta({ path: '/admin/login' });
useSeoMeta({ title: '관리자 로그인 · 블라리요', robots: 'noindex, nofollow' });
const route = useRoute();
const requestFetch = useRequestFetch();
const {
  data: session,
  error,
  refresh,
} = await useAsyncData(
  'admin-session',
  () =>
    requestFetch<{ authenticated: boolean; localLoginAvailable: boolean }>('/api/admin/session'),
  { server: false }
);
const target = computed(() => adminReturnPath(route.query.returnTo));
const busy = ref(false),
  message = ref('');
async function login() {
  if (busy.value) return;
  busy.value = true;
  message.value = '';
  try {
    await $fetch('/api/admin/local-session', { method: 'POST', body: {}, retry: 0 });
    await refresh();
    await navigateTo(target.value);
  } catch {
    message.value = '로그인하지 못했습니다. 개발 서버 연결을 확인하고 다시 시도해 주세요.';
  } finally {
    busy.value = false;
  }
}
async function logout() {
  busy.value = true;
  try {
    await $fetch('/api/admin/local-session', { method: 'DELETE', retry: 0 });
    await refresh();
    message.value = '로그아웃했습니다.';
  } catch {
    message.value = '로그아웃하지 못했습니다. 다시 시도해 주세요.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="admin-login">
    <div class="login-brand">
      <span class="brand-mark" aria-hidden="true">B</span> 블라리요 <span>관리자</span>
    </div>
    <div class="login-card">
      <span class="admin-eyebrow">관리자 접속</span>
      <h1>{{ session?.authenticated ? '관리자 인증이 완료됐습니다' : '콘텐츠 관리 시작하기' }}</h1>
      <p class="login-description">수집한 글을 살펴보고, 검수한 콘텐츠를 게시하세요.</p>
      <div v-if="error" class="admin-alert" role="alert">
        접속 정보를 불러오지 못했습니다. <button @click="refresh()">다시 시도</button>
      </div>
      <template v-else-if="session?.authenticated">
        <div class="login-actions">
          <NuxtLink class="admin-button primary" :to="target">관리 화면으로</NuxtLink>
          <button
            v-if="session.localLoginAvailable"
            class="login-signout"
            :disabled="busy"
            @click="logout"
          >
            로그아웃
          </button>
        </div>
      </template>
      <template v-else-if="session?.localLoginAvailable">
        <div class="login-environment">
          <span class="status-dot" /> 로컬 개발 환경
          <small>이 컴퓨터의 개발 DB에 연결합니다.</small>
        </div>
        <button class="primary" :disabled="busy" @click="login">
          {{ busy ? '로그인 중…' : '개발 관리자 로그인' }} <span aria-hidden="true">→</span>
        </button>
        <p class="login-note">아이디나 비밀번호 입력 없이 이 브라우저에서 시작할 수 있습니다.</p>
      </template>
      <template v-else>
        <p class="admin-alert">
          등록된 관리자 계정의 Cloudflare Access 인증이 필요합니다. 운영 사이트의 관리자 주소로
          접속해 인증을 진행해 주세요.
        </p>
        <NuxtLink class="admin-button" :to="target">관리자 인증 다시 확인</NuxtLink>
      </template>
      <p v-if="message" role="status" class="admin-feedback">{{ message }}</p>
    </div>
    <NuxtLink class="login-public" to="/meme">← 공개 사이트로</NuxtLink>
  </main>
</template>
