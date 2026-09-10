<script setup lang="ts">
const modal = ref<HTMLDialogElement | null>(null),
  kind = ref<'' | 'terms' | 'privacy' | 'cookie-settings'>(''),
  returnFocus = ref<HTMLElement | null>(null);
const config = useRuntimeConfig().public;
const message = ref('');
const { enabled, consent, ready, storageError, save } = useConsent();
function open(type: 'terms' | 'privacy' | 'cookie-settings', event: MouseEvent) {
  event.preventDefault();
  kind.value = type;
  returnFocus.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  void nextTick(() => modal.value?.showModal());
}
function close() {
  modal.value?.close();
  kind.value = '';
  returnFocus.value?.focus();
}
async function copyEmail() {
  try {
    await navigator.clipboard.writeText(config.rightsEmail);
    message.value = '이메일 주소를 복사했습니다.';
  } catch {
    message.value = '주소를 직접 선택해 복사해 주세요.';
  }
}
</script>
<template>
  <footer>
    <span>{{ config.footerTagline }}</span
    ><a href="/terms" @click="open('terms', $event)">이용약관</a
    ><a href="/privacy" @click="open('privacy', $event)">개인정보처리방침</a
    ><a href="/cookie-settings" @click="open('cookie-settings', $event)">쿠키 설정</a
    ><template v-if="config.rightsEmail"
      ><a :href="`mailto:${config.rightsEmail}`">권리 침해 신고·요청</a
      ><span>{{ config.rightsEmail }}</span
      ><button @click="copyEmail">이메일 주소 복사</button></template
    >
    <p role="status">{{ message }}</p>
  </footer>
  <aside v-if="enabled && ready && !consent && !kind" class="consent-banner" aria-label="쿠키 선택">
    <p>이용 통계 분석에 동의하시겠어요? 거부해도 콘텐츠를 이용할 수 있습니다.</p>
    <button @click="save(false)">필수만 사용</button
    ><a href="/cookie-settings" @click="open('cookie-settings', $event)">설정</a
    ><button @click="save(true)">모두 허용</button>
    <p role="status">{{ storageError }}</p>
  </aside>
  <dialog
    ref="modal"
    class="policy-dialog"
    @close="
      kind = '';
      returnFocus?.focus();
    "
    @click="(e) => e.target === modal && close()"
  >
    <button @click="close">닫기</button
    ><CookieSettings v-if="kind === 'cookie-settings'" @saved="close" /><PolicyViewer
      v-else-if="kind"
      :key="kind"
      :type="kind"
    />
  </dialog>
</template>
<style scoped>
.policy-dialog {
  top: 5vh;
  max-height: 85vh;
  overflow: auto;
  width: 720px;
}
.policy-dialog::backdrop {
  background: #0007;
}
.consent-banner {
  position: fixed;
  bottom: 0;
  background: #f9f9f9;
  border: 1px solid #8b9fa8;
  padding: 16px;
  width: min(100%, 1000px);
  z-index: 10;
}
.consent-banner button {
  min-height: 44px;
  margin: 4px;
}
.consent-banner a {
  margin: 12px;
}
</style>
