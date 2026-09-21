<script setup lang="ts">
import type { XCard } from '~/utils/x-posts';
import { loadXWidgets } from '~/utils/x-widgets';
const props = defineProps<{ card: XCard }>();
const enabled = useRuntimeConfig().public.xEmbedsEnabled === true;
const root = ref<HTMLElement | null>(null),
  slot = ref<HTMLElement | null>(null);
const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle');
let active = true,
  generation = 0,
  observer: IntersectionObserver | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
  if (!enabled || state.value === 'loading' || state.value === 'ready' || !slot.value) return;
  const current = ++generation;
  state.value = 'loading';
  const target = document.createElement('div');
  slot.value.replaceChildren(target);
  try {
    const sdk = await loadXWidgets();
    if (!active || current !== generation) return;
    if (!sdk) throw Error('X_WIDGET_UNAVAILABLE');
    const result = await Promise.race([
      sdk.widgets.createTweet(props.card.reference.id, target, {
        dnt: true,
        lang: 'ko',
        theme: 'light',
        conversation: 'none',
        width: Math.max(250, Math.min(550, root.value?.clientWidth || 550)),
      }),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), 12000);
      }),
    ]);
    if (!active || current !== generation) return;
    if (!result) throw Error('X_POST_UNAVAILABLE');
    state.value = 'ready';
  } catch {
    if (active && current === generation) {
      state.value = 'failed';
      target.remove();
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
onMounted(() => {
  if (!enabled || !root.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect();
        void load();
      }
    },
    { rootMargin: '200px' }
  );
  observer.observe(root.value);
});
onBeforeUnmount(() => {
  active = false;
  generation++;
  observer?.disconnect();
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <section
    ref="root"
    class="x-post"
    :data-x-id="card.reference.id"
    :aria-label="`X 게시물: @${card.reference.handle}`"
  >
    <div ref="slot" class="x-widget" :class="{ ready: state === 'ready' }" />
    <div v-if="state !== 'ready'" class="x-snapshot">
      <header class="x-header">
        <div>
          <strong>{{ card.author || `@${card.reference.handle}` }}</strong
          ><span>@{{ card.reference.handle }}</span>
        </div>
        <span class="x-mark" aria-hidden="true">𝕏</span>
      </header>
      <footer class="x-footer">
        <a :href="card.reference.url" target="_blank" rel="noopener noreferrer"
          >X에서 보기 <span aria-hidden="true">↗</span></a
        >
        <span v-if="state === 'loading'" role="status">게시물 불러오는 중…</span>
        <button v-if="state === 'failed'" type="button" @click="load">다시 불러오기</button>
      </footer>
      <p v-if="state === 'failed'" class="x-status" role="status">
        게시물을 불러오지 못했습니다. 원문이 삭제되었거나 비공개로 전환됐을 수 있습니다.
      </p>
    </div>
  </section>
</template>

<style scoped>
.x-post {
  width: 100%;
  max-width: 550px;
  margin: 24px auto;
  min-width: 0;
}
.x-snapshot {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #fff;
  padding: 18px;
  overflow: hidden;
}
.x-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.x-header div {
  display: grid;
  min-width: 0;
}
.x-header strong {
  overflow-wrap: anywhere;
  font-size: 16px;
}
.x-header span:not(.x-mark) {
  color: var(--muted);
  font-size: 14px;
}
.x-mark {
  font-size: 28px;
  line-height: 1;
}
.x-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.65;
  margin: 16px 0;
  font-size: 16px;
}
.x-images {
  display: grid;
  gap: 6px;
  margin: 16px -1px;
  border-radius: 12px;
  overflow: hidden;
}
.x-images img {
  display: block;
  width: 100%;
  height: auto;
}
.x-footer {
  border-top: 1px solid var(--line);
  padding-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
}
.x-footer a {
  font-weight: 700;
  color: var(--brand-strong);
}
.x-footer span,
.x-status {
  color: var(--muted);
  font-size: 12px;
}
.x-footer button {
  font-size: 12px;
  padding: 4px 8px;
}
.x-status {
  margin: 10px 0 0;
}
.x-widget:not(.ready) {
  height: 0;
  overflow: hidden;
  visibility: hidden;
}
.x-widget :deep(iframe) {
  max-width: 100%;
}
@media (max-width: 380px) {
  .x-snapshot {
    padding: 14px;
  }
}
</style>
