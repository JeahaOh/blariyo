<script setup lang="ts">
import {
  keywordGroups,
  keywordScopes,
  keywordModes,
  keywordEnabledOptions,
  type KeywordDraft,
} from '../utils/keyword-editor';
const draft = defineModel<KeywordDraft>({ required: true });
defineProps<{ blocked: boolean }>();
defineEmits<{ save: [] }>();
</script>
<template>
  <form
    id="keyword-add-form"
    class="keyword-add keyword-form"
    aria-label="키워드 추가 입력"
    @submit.prevent="$emit('save')"
  >
    <label
      >키워드<input
        v-model="draft.keyword"
        aria-label="새 키워드"
        required
        maxlength="80"
        :disabled="blocked"
    /></label>
    <label
      >분류<SourceSettingSelect
        v-model="draft.group"
        :options="keywordGroups"
        label="새 키워드 분류"
        :disabled="blocked"
    /></label>
    <label
      >검사 범위<SourceSettingSelect
        v-model="draft.scope"
        :options="keywordScopes"
        label="새 키워드 검사 범위"
        :disabled="blocked"
    /></label>
    <label
      >일치 방식<SourceSettingSelect
        v-model="draft.matchMode"
        :options="keywordModes"
        label="새 키워드 일치 방식"
        :disabled="blocked"
    /></label>
    <label
      >사용 여부<SourceSettingSelect
        v-model="draft.enabled"
        :options="keywordEnabledOptions"
        label="새 키워드 사용 여부"
        :disabled="blocked"
    /></label>
    <button :disabled="blocked || !draft.keyword.trim()">추가</button>
  </form>
</template>
