<script setup lang="ts">
defineProps<{ title: string }>();
const opened = defineModel<boolean>({ default: false });
const dialog = ref<HTMLDialogElement>();
const titleId = useId();
watch(opened, (value) => {
  if (value) dialog.value?.showModal();
  else dialog.value?.close();
});
function keepFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) ?? [])].filter(element => element.getClientRects().length > 0);
  const first = controls[0], last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
</script>

<template>
  <dialog ref="dialog" class="app-dialog" :aria-labelledby="titleId" @close="opened = false" @keydown="keepFocus">
    <h2 :id="titleId">{{ title }}</h2>
    <div class="app-dialog-content"><slot /></div>
    <div class="app-dialog-actions"><slot name="actions"><form method="dialog"><button autofocus>확인</button></form></slot></div>
  </dialog>
</template>

<style scoped>
.app-dialog {
  width: min(400px, calc(100vw - 32px));
  max-height: calc(100dvh - 40px);
  overflow: auto;
  margin: auto;
  padding: 20px;
  border: 1px solid var(--line, #cad5da);
  border-top: 3px solid var(--brand);
  border-radius: 12px;
  background: var(--surface, #fff);
  color: var(--ink, #1b262c);
  box-shadow: 0 18px 64px #1b262c33;
}
.app-dialog::backdrop { background: #1b262c99; }
.app-dialog h2 { margin: 0 0 16px; font-size: 18px; }
.app-dialog-content { font-size: 14px; line-height: 1.6; }
.app-dialog-content :deep(p) { margin: 0; }
.app-dialog-content :deep(p + p) { margin-top: 12px; }
.app-dialog form { display: flex; justify-content: flex-end; margin: 20px 0 0; padding: 0; }
.app-dialog-actions :deep(.dialog-confirm-actions) { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.app-dialog-actions :deep(.dialog-confirm-actions button) { height: 44px; margin: 0; padding: 8px 18px; font-size: 14px; }
.app-dialog button { display: inline-flex; align-items: center; justify-content: center; height: 44px; min-height: 44px; margin: 0; padding: 8px 20px; font-size: 14px; line-height: 20px; background: #087f7b; border-color: #087f7b; color: #fff; }
</style>
