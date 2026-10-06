import type { MaybeRefOrGetter } from 'vue';

export function useUiLoadingState() {
  const tasks = useState<string[]>('ui-loading-tasks', () => []);
  const active = computed(() => tasks.value.length > 0);
  function begin() {
    if (import.meta.server) return () => {};
    const id = crypto.randomUUID();
    tasks.value = [...tasks.value, id];
    return () => {
      tasks.value = tasks.value.filter((task) => task !== id);
    };
  }
  return {
    active,
    begin,
    reset: () => {
      tasks.value = [];
    },
  };
}

/** Track actual work, not unresolved confirmation/recovery state. */
export function useUiLoading(pending: MaybeRefOrGetter<boolean>) {
  const { begin } = useUiLoadingState();
  if (import.meta.server) return;
  let finish: (() => void) | undefined;
  watch(
    () => toValue(pending),
    (value) => {
      if (value) finish ??= begin();
      else {
        finish?.();
        finish = undefined;
      }
    },
    { immediate: true, flush: 'sync' }
  );
  onScopeDispose(() => finish?.());
}
