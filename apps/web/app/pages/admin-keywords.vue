<script setup lang="ts">
import '~/assets/css/keyword-editor.css';
import { useKeywordEditor } from '../composables/useKeywordEditor';
import { useKeywordSelection } from '../composables/useKeywordSelection';
import { useUnsavedChanges } from '../composables/useUnsavedChanges';
import {
  keywordFilterGroups,
  keywordFilterEnabled,
  keywordChanged,
  sameKeywordDraft,
  emptyKeywordDraft,
} from '../utils/keyword-editor';
definePageMeta({ path: '/admin/keywords' });
useHead({ title: '키워드 관리 · 블라리요' });
const requestFetch = useRequestFetch();
const { data: features } = await useAsyncData('keyword-management-features', () =>
  requestFetch<{ batchReview: boolean }>('/api/admin/features')
);
const {
  rows,
  version,
  canManage,
  busy,
  loadFailed,
  loaded,
  notice,
  newKeyword,
  blocked,
  load,
  reload,
  save,
  saveBulk,
  remove,
} = useKeywordEditor();
const {
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
} = useKeywordSelection(rows, blocked);
const dirty = computed(
  () =>
    rows.value.some((row) => keywordChanged(row)) ||
    !sameKeywordDraft(newKeyword.value, emptyKeywordDraft()) ||
    (bulkMode.value !== 'KEEP' && pendingItems.value.length > 0)
);
useUnsavedChanges(dirty, busy);
useUiLoading(busy);
const showAdd = ref(false);
async function saveSelected() {
  if (await saveBulk(pendingItems.value)) bulkMode.value = 'KEEP';
}
async function confirmDelete() {
  try {
    await remove([...deleteIds.value]);
  } finally {
    cancelDelete();
  }
}
if (features.value?.batchReview) await load();
</script>
<template>
  <main class="keyword-management">
    <header class="keyword-heading">
      <h1>키워드 관리</h1>
      <div v-if="features?.batchReview" class="keyword-heading-actions">
        <button
          v-if="loaded && canManage"
          class="keyword-add-trigger"
          :aria-expanded="showAdd"
          aria-controls="keyword-add-form"
          :disabled="blocked"
          @click="showAdd = !showAdd"
        >
          키워드 추가
        </button>
        <button :disabled="busy" @click="reload">다시 조회</button>
      </div>
    </header>
    <p v-if="!features?.batchReview">키워드 관리 기능이 활성화되어 있지 않습니다.</p>
    <template v-else>
      <p v-if="loadFailed" role="alert">키워드를 불러오지 못했습니다. 다시 조회해 주세요.</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <template v-if="loaded">
        <p v-if="!canManage" class="muted">설정 변경은 소유자만 할 수 있습니다.</p>
        <KeywordEditorForm
          v-if="canManage"
          v-show="showAdd"
          v-model="newKeyword"
          :blocked="blocked"
          @save="save()"
        />
        <section class="keyword-list" aria-label="키워드 목록">
          <div class="keyword-filters">
            <label
              >검색<input v-model="search" type="search" placeholder="키워드 검색" :disabled="busy"
            /></label>
            <label
              >분류<SourceSettingSelect
                v-model="groupFilter"
                :options="keywordFilterGroups"
                label="분류 필터"
                :disabled="busy"
            /></label>
            <label
              >사용 여부<SourceSettingSelect
                v-model="enabledFilter"
                :options="keywordFilterEnabled"
                label="사용 여부 필터"
                :disabled="busy"
            /></label>
          </div>
          <div v-if="!canManage" class="keyword-count">{{ filtered.length }}개</div>
          <KeywordBulkActions
            v-if="canManage"
            v-model:mode="bulkMode"
            :target-label="targetLabel"
            :target-count="targets.length"
            :pending-count="pendingItems.length"
            :selected-count="selectedRows.length"
            :page-count="visible.length"
            :page-selected="pageSelected"
            :page-part-selected="pagePartSelected"
            :blocked="blocked"
            :invalid="pendingItems.some((item) => !item.keyword.trim())"
            @save="saveSelected"
            @delete="requestSelectedDelete"
            @clear="clearSelection"
            @toggle-page="togglePage"
          />
          <KeywordDeleteConfirmation
            v-if="deleteIds.length"
            :count="deleteIds.length"
            :busy="busy"
            :blocked="blocked"
            @confirm="confirmDelete"
            @cancel="cancelDelete"
          />
          <KeywordEditorTable
            v-if="visible.length"
            :rows="visible"
            v-model:selected-ids="selectedIds"
            :can-manage="canManage"
            :blocked="blocked"
            :page-selected="pageSelected"
            :page-part-selected="pagePartSelected"
            @toggle-page="togglePage"
            @save="save"
            @delete="requestDelete([$event])"
          />
          <p v-else class="muted">조건에 맞는 키워드가 없습니다.</p>
          <footer class="keyword-footer">
            <small>규칙 {{ version }}</small>
            <nav v-if="pages > 1" class="keyword-pages" aria-label="키워드 페이지">
              <button :disabled="busy || page <= 1" @click="page--">이전</button
              ><span>{{ page }} / {{ pages }}</span
              ><button :disabled="busy || page >= pages" @click="page++">다음</button>
            </nav>
          </footer>
        </section>
      </template>
    </template>
  </main>
</template>
