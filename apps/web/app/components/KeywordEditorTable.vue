<script setup lang="ts">
import {
  keywordGroups,
  keywordScopes,
  keywordModes,
  keywordEnabledOptions,
  keywordChanged,
  type KeywordRow,
} from '../utils/keyword-editor';
const rows = defineModel<KeywordRow[]>('rows', { required: true });
const selectedIds = defineModel<string[]>('selectedIds', { required: true });
defineProps<{
  canManage: boolean;
  blocked: boolean;
  pageSelected: boolean;
  pagePartSelected: boolean;
}>();
defineEmits<{ save: [row: KeywordRow]; delete: [id: string]; togglePage: [] }>();
</script>
<template>
  <table class="keyword-table">
    <thead>
      <tr>
        <th v-if="canManage" class="keyword-check">
          <input
            type="checkbox"
            aria-label="현재 페이지 선택"
            :checked="pageSelected"
            :indeterminate="pagePartSelected"
            :disabled="blocked"
            @change="$emit('togglePage')"
          />
        </th>
        <th class="keyword-name">키워드</th>
        <th class="keyword-group">분류</th>
        <th class="keyword-scope">검사 범위</th>
        <th class="keyword-mode">일치 방식</th>
        <th class="keyword-enabled">사용 여부</th>
        <th v-if="canManage" class="keyword-actions">작업</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.keywordId"
        :data-keyword-id="row.keywordId"
        :class="{
          'is-modified': keywordChanged(row),
          'is-selected': selectedIds.includes(row.keywordId),
        }"
      >
        <td v-if="canManage" class="keyword-check" data-label="선택">
          <input
            v-model="selectedIds"
            type="checkbox"
            :value="row.keywordId"
            :aria-label="`${row.keyword} 선택`"
            :disabled="blocked"
          />
        </td>
        <td class="keyword-name-cell" data-label="키워드">
          <input
            v-model="row.draft.keyword"
            :aria-label="`${row.keyword} 키워드`"
            maxlength="80"
            :disabled="blocked"
          />
          <span v-if="keywordChanged(row)" class="keyword-modified">수정됨</span>
        </td>
        <td data-label="분류">
          <SourceSettingSelect
            v-model="row.draft.group"
            :options="keywordGroups"
            :label="`${row.keyword} 분류`"
            :disabled="blocked"
          />
        </td>
        <td data-label="검사 범위">
          <SourceSettingSelect
            v-model="row.draft.scope"
            :options="keywordScopes"
            :label="`${row.keyword} 검사 범위`"
            :disabled="blocked"
          />
        </td>
        <td data-label="일치 방식">
          <SourceSettingSelect
            v-model="row.draft.matchMode"
            :options="keywordModes"
            :label="`${row.keyword} 일치 방식`"
            :disabled="blocked"
          />
        </td>
        <td data-label="사용 여부">
          <SourceSettingSelect
            v-model="row.draft.enabled"
            :options="keywordEnabledOptions"
            :label="`${row.keyword} 사용 여부`"
            :disabled="blocked"
            :enabled="row.draft.enabled"
          />
        </td>
        <td v-if="canManage" class="keyword-save">
          <div>
            <button
              :aria-label="`${row.keyword} 저장`"
              :disabled="blocked || !keywordChanged(row) || !row.draft.keyword.trim()"
              @click="$emit('save', row)"
            >
              저장
            </button>
            <button
              class="keyword-delete"
              :aria-label="`${row.keyword} 삭제`"
              :disabled="blocked"
              @click="$emit('delete', row.keywordId)"
            >
              삭제
            </button>
          </div>
          <span v-if="row.message" role="status">{{ row.message }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
