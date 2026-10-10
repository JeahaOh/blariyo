<script setup lang="ts">
import { keywordBulkModes, type KeywordBulkMode } from '../utils/keyword-editor';
const mode = defineModel<KeywordBulkMode>('mode', { required: true });
defineProps<{
  targetLabel: string;
  targetCount: number;
  pendingCount: number;
  selectedCount: number;
  pageCount: number;
  pageSelected: boolean;
  pagePartSelected: boolean;
  blocked: boolean;
  invalid: boolean;
}>();
defineEmits<{ save: []; delete: []; clear: []; togglePage: [] }>();
</script>
<template>
  <section class="keyword-bulk" aria-label="키워드 일괄 작업">
    <div class="keyword-selection">
      <strong>{{ targetLabel }}</strong
      ><small v-if="pendingCount">변경 {{ pendingCount }}개</small>
      <label class="keyword-page-check"
        ><input
          type="checkbox"
          aria-label="현재 페이지 선택"
          :checked="pageSelected"
          :indeterminate="pagePartSelected"
          :disabled="blocked || !pageCount"
          @change="$emit('togglePage')"
        />현재 페이지 선택</label
      >
      <button
        v-if="selectedCount"
        class="keyword-clear"
        :disabled="blocked"
        @click="$emit('clear')"
      >
        선택 해제
      </button>
    </div>
    <div class="keyword-bulk-actions">
      <div class="keyword-bulk-mode">
        <SourceSettingSelect
          v-model="mode"
          :options="keywordBulkModes"
          label="일괄 일치 방식"
          :disabled="blocked || !targetCount"
        />
      </div>
      <button
        class="keyword-bulk-save"
        :disabled="blocked || !pendingCount || invalid"
        @click="$emit('save')"
      >
        일괄 저장
      </button>
      <button class="keyword-delete" :disabled="blocked || !selectedCount" @click="$emit('delete')">
        선택한 {{ selectedCount }}개 삭제
      </button>
    </div>
  </section>
</template>
