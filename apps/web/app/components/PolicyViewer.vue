<script setup lang="ts">
import type { ApiResponse } from '~~/shared/api-types';
const props = defineProps<{ type: 'terms' | 'privacy' }>();
const selected = ref<string | undefined>(undefined);
const { data, error, status } = await useFetch<ApiResponse<'getPolicy'>>(
  () => `/api/v1/policies/${props.type}`,
  {
    query: computed(() => (selected.value ? { version: selected.value } : {})),
  }
);
const day = (v: string) => v?.slice(0, 10).replaceAll('-', '.');
</script>
<template>
  <section>
    <p v-if="status === 'pending'" role="status">불러오는 중입니다.</p>
    <p v-else-if="error">정책을 불러올 수 없습니다.</p>
    <template v-else-if="data"
      ><h1>{{ data.data.policy.title }}</h1>
      <div class="policy-body" v-html="data.data.policy.bodyHtml" />
      <h2>정책 이력</h2>
      <button
        class="policy-history"
        v-for="item in data.data.history"
        :key="item.version"
        @click="selected = item.version"
      >
        {{ item.version }} · {{ day(item.effectiveAt) }} ~
        {{ item.endedAt ? day(item.endedAt) : '시행 중' }}
      </button></template
    >
  </section>
</template>
<style scoped>
.policy-body {
  overflow-wrap: anywhere;
}
.policy-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
}
.policy-body :deep(td),
.policy-body :deep(th) {
  border: 1px solid #8b9fa8;
  padding: 8px;
}
.policy-history {
  display: block;
  width: 100%;
  margin: 8px 0;
  text-align: left;
}
</style>
