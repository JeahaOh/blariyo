<script setup lang="ts">
const { active } = useUiLoadingState();
const visible = ref(false);
let shownAt = 0;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  active,
  (pending) => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (pending) {
      if (!visible.value)
        showTimer = setTimeout(() => {
          shownAt = performance.now();
          visible.value = true;
        }, 150);
    } else if (visible.value) {
      hideTimer = setTimeout(
        () => {
          visible.value = false;
        },
        Math.max(0, 300 - (performance.now() - shownAt))
      );
    }
  },
  { immediate: true, flush: 'sync' }
);
onUnmounted(() => {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
});
</script>
<template>
  <div v-if="visible" class="app-loading-bar" role="progressbar" aria-label="화면 작업 처리 중">
    <span />
  </div>
  <span class="app-loading-announcement" aria-live="polite">{{
    visible ? '처리 중입니다.' : ''
  }}</span>
</template>
<style scoped>
.app-loading-bar {
  position: fixed;
  inset: 0 0 auto;
  height: 3px;
  z-index: 1000;
  pointer-events: none;
  overflow: hidden;
  background: var(--brand-soft);
}
.app-loading-bar > span {
  display: block;
  width: 35%;
  height: 100%;
  background: var(--brand);
  animation: app-loading-slide 1.2s ease-in-out infinite;
}
@keyframes app-loading-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(286%);
  }
}
.app-loading-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .app-loading-bar > span {
    animation: none;
    transform: translateX(90%);
  }
}
</style>
