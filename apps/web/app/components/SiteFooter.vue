<script setup lang="ts">
const modal = ref<HTMLDialogElement | null>(null),
  kind = ref<'' | 'terms' | 'privacy' | 'cookie-settings'>(''),
  returnFocus = ref<HTMLElement | null>(null);
const config = useRuntimeConfig().public;
const route = useRoute();
const rightsMail = computed(() => {
  const subject = `${config.siteName} 권리 침해·게시 중단 요청`;
  const page = new URL(route.path, config.siteOrigin).href;
  const body = `대상 URL: ${page}\n\n요청 내용: \n권리자 확인 자료: \n회신 연락처: `;
  return {
    href: `mailto:${config.rightsEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    text: `받는 사람: ${config.rightsEmail}\n제목: ${subject}\n\n${body}`,
  };
});
const contactMail = computed(() => {
  const subject = `${config.siteName} 문의·오류 제보`;
  const page = new URL(route.path, config.siteOrigin).href;
  const body = `대상 URL: ${page}\n\n문의 내용 또는 발생한 문제: \n사용 기기·브라우저: \n회신 연락처: `;
  return {
    href: `mailto:${config.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    text: `받는 사람: ${config.contactEmail}\n제목: ${subject}\n\n${body}`,
  };
});
const manualCopy = ref<HTMLDialogElement | null>(null);
const manualText = ref('');
const manualTitle = ref('권리 문의 양식');
const mailAnchor = ref<HTMLAnchorElement | null>(null);
let cancelMailWait = () => {};
function prepareMailFallback(event: MouseEvent, type: 'rights' | 'contact') {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  cancelMailWait();
  const text = type === 'rights' ? rightsMail.value.text : contactMail.value.text;
  mailAnchor.value = event.currentTarget as HTMLAnchorElement;
  manualTitle.value = type === 'rights' ? '권리 문의 양식' : '문의·오류 제보 양식';
  let active = true;
  // Browsers expose no mailto result. Cancel on departure; silence is only a fallback hint.
  const cancel = () => {
    active = false;
    window.clearTimeout(timer);
    window.removeEventListener('blur', cancel);
    document.removeEventListener('visibilitychange', visibilityChanged);
  };
  const visibilityChanged = () => {
    if (document.hidden) cancel();
  };
  async function copyFallback() {
    try {
      await navigator.clipboard.writeText(text);
      if (!active) return;
      cancel();
      window.alert(
        '메일 작성 창이 열리지 않았다면, 사용하시는 메일에 붙여 넣어 주세요.\n받는 이메일 주소와 문의 양식을 복사했습니다.'
      );
    } catch {
      if (!active) return;
      cancel();
      manualText.value = text;
      await nextTick();
      manualCopy.value?.showModal();
      manualCopy.value?.querySelector('textarea')?.select();
      window.alert(
        '자동 복사가 허용되지 않았습니다.\n화면의 이메일 주소와 문의 양식을 직접 복사해 주세요.'
      );
    }
  }
  const timer = window.setTimeout(() => {
    void copyFallback();
  }, 1600);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', visibilityChanged);
  cancelMailWait = cancel;
}
// Cancel when navigation starts, before Nuxt finishes loading the next page.
const removeNavigationGuard = useRouter().beforeEach(() => {
  cancelMailWait();
});
onBeforeUnmount(() => {
  cancelMailWait();
  removeNavigationGuard();
});
const { enabled, consent, ready, storageError, save } = useConsent();
function open(type: 'terms' | 'privacy' | 'cookie-settings', event: MouseEvent) {
  if (!modal.value || typeof modal.value.showModal !== 'function') return;
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
</script>
<template>
  <footer class="site-footer">
    <div class="footer-identity">
      <NuxtLink to="/meme" class="footer-brand" :aria-label="`${config.siteName} 홈`">
        <span class="brand-mark" aria-hidden="true">B</span><span>{{ config.siteName }}</span>
      </NuxtLink>
      <p class="footer-tagline">{{ config.footerTagline }}</p>
    </div>
    <div class="footer-info">
      <nav aria-label="정책">
        <a href="/terms" @click="open('terms', $event)">이용약관</a>
        <a href="/privacy" class="footer-privacy" @click="open('privacy', $event)"
          >개인정보처리방침</a
        >
        <a href="/cookie-settings" @click="open('cookie-settings', $event)">쿠키 설정</a>
      </nav>
      <nav v-if="config.contactEmail || config.rightsEmail" aria-label="문의">
        <a
          v-if="config.contactEmail"
          :href="contactMail.href"
          @click="prepareMailFallback($event, 'contact')"
          >문의·오류 제보</a
        >
        <template v-if="config.rightsEmail">
          <a :href="rightsMail.href" @click="prepareMailFallback($event, 'rights')">권리 문의</a>
        </template>
      </nav>
      <p class="footer-copyright">© 2026 Blariyo. All rights reserved.</p>
    </div>
  </footer>
  <dialog
    ref="manualCopy"
    class="rights-copy-dialog"
    aria-labelledby="rights-copy-title"
    @close="mailAnchor?.focus()"
  >
    <h2 id="rights-copy-title">{{ manualTitle }}</h2>
    <p>아래 내용을 복사해 사용하시는 메일에 붙여 넣어 주세요.</p>
    <textarea
      :value="manualText"
      readonly
      aria-label="받는 이메일 주소와 문의 양식"
      rows="10"
      @focus="($event.target as HTMLTextAreaElement).select()"
    />
    <button @click="manualCopy?.close()">닫기</button>
  </dialog>
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
    :aria-label="
      kind === 'terms' ? '이용약관' : kind === 'privacy' ? '개인정보처리방침' : '쿠키 설정'
    "
    @close="
      kind = '';
      returnFocus?.focus();
    "
    @click="(e) => e.target === modal && close()"
  >
    <button class="policy-close" @click="close" aria-label="닫기">×</button>
    <div v-if="kind === 'cookie-settings'" class="cookie-policy-content">
      <CookieSettings @saved="close" />
    </div>
    <PolicyViewer v-else-if="kind" :key="kind" :type="kind" />
  </dialog>
</template>
<style scoped>
.rights-copy-dialog {
  width: min(580px, calc(100vw - 28px));
  padding: 24px;
}
.rights-copy-dialog textarea {
  width: 100%;
  resize: vertical;
  padding: 12px;
}
.rights-copy-dialog::backdrop {
  background: rgba(27, 38, 44, 0.7);
}
.policy-dialog {
  top: 0;
  max-height: calc(100dvh - 40px);
  overflow: auto;
  width: min(720px, calc(100vw - 28px));
  padding: 0;
  border-top: 5px solid var(--brand);
}
.policy-dialog::backdrop {
  background: rgba(27, 38, 44, 0.84);
  backdrop-filter: blur(3px);
}
.policy-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 27px;
  color: var(--muted);
}
.cookie-policy-content {
  padding: 28px 30px;
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
