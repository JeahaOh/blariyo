import type { Ref } from 'vue';
import { keywordBulkItems, type KeywordRow, type KeywordBulkMode } from '../utils/keyword-editor';

export function useKeywordSelection(rows: Ref<KeywordRow[]>, blocked: Ref<boolean>) {
  const search = ref(''),
    groupFilter = ref('all'),
    enabledFilter = ref('all'),
    page = ref(1);
  const selectedIds = ref<string[]>([]),
    bulkMode = ref<KeywordBulkMode>('KEEP'),
    deleteIds = ref<string[]>([]);
  const filtered = computed(() =>
    rows.value.filter(
      (row) =>
        (!search.value.trim() ||
          row.keyword.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())) &&
        (groupFilter.value === 'all' || row.group === groupFilter.value) &&
        (enabledFilter.value === 'all' || row.enabled === (enabledFilter.value === 'on'))
    )
  );
  const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 25)));
  const visible = computed(() => filtered.value.slice((page.value - 1) * 25, page.value * 25));
  const selectedRows = computed(() => {
    const ids = new Set(selectedIds.value);
    return rows.value.filter((row) => ids.has(row.keywordId));
  });
  const targets = computed(() => (selectedIds.value.length ? selectedRows.value : filtered.value));
  const targetLabel = computed(
    () =>
      `${selectedIds.value.length ? '선택한' : search.value.trim() || groupFilter.value !== 'all' || enabledFilter.value !== 'all' ? '검색 결과' : '전체'} ${targets.value.length}개`
  );
  const pendingItems = computed(() => keywordBulkItems(targets.value, bulkMode.value));
  const pageSelected = computed(
    () =>
      visible.value.length > 0 &&
      visible.value.every((row) => selectedIds.value.includes(row.keywordId))
  );
  const pagePartSelected = computed(
    () =>
      !pageSelected.value && visible.value.some((row) => selectedIds.value.includes(row.keywordId))
  );

  function cancelDelete() {
    deleteIds.value = [];
  }
  function clearSelection() {
    selectedIds.value = [];
    cancelDelete();
  }
  function requestDelete(ids: string[]) {
    if (!blocked.value && ids.length) {
      deleteIds.value = [...ids];
    }
  }
  function requestSelectedDelete() {
    requestDelete(selectedRows.value.map((row) => row.keywordId));
  }
  function togglePage() {
    if (blocked.value) return;
    const ids = new Set(selectedIds.value),
      removing = pageSelected.value;
    for (const row of visible.value) {
      if (removing) ids.delete(row.keywordId);
      else ids.add(row.keywordId);
    }
    selectedIds.value = [...ids];
  }
  watch([search, groupFilter, enabledFilter], () => {
    page.value = 1;
    clearSelection();
    bulkMode.value = 'KEEP';
  });
  watch(selectedIds, (ids, previous) => {
    if (ids.join(',') !== previous.join(',')) {
      bulkMode.value = 'KEEP';
      cancelDelete();
    }
  });
  watch(pages, (value) => {
    page.value = Math.min(page.value, value);
  });
  watch(rows, (value) => {
    const ids = new Set(value.map((row) => row.keywordId));
    selectedIds.value = selectedIds.value.filter((id) => ids.has(id));
    cancelDelete();
  });
  return {
    search,
    groupFilter,
    enabledFilter,
    page,
    selectedIds,
    bulkMode,
    deleteIds,
    filtered,
    pages,
    visible,
    selectedRows,
    targets,
    targetLabel,
    pendingItems,
    pageSelected,
    pagePartSelected,
    clearSelection,
    cancelDelete,
    requestDelete,
    requestSelectedDelete,
    togglePage,
  };
}
