import type { MaybeRefOrGetter } from 'vue';

/** Keep page-level navigation and browser refresh under the same dirty/busy rule. */
export function useUnsavedChanges(
  dirty: MaybeRefOrGetter<boolean>,
  busy: MaybeRefOrGetter<boolean>
) {
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!toValue(dirty) && !toValue(busy)) return;
    event.preventDefault();
    event.returnValue = '';
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload));
  onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload));
  onBeforeRouteLeave(
    () => !toValue(busy) && (!toValue(dirty) || confirm('저장하지 않은 변경을 버리고 이동할까요?'))
  );
}
