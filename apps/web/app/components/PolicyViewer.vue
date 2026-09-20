<script setup lang="ts">
import type { ApiResponse } from '~~/shared/api-types';
const props = defineProps<{ type: 'terms' | 'privacy' }>();
const selected = ref<string | undefined>(undefined);
const { data, error, status, refresh } = await useFetch<ApiResponse<'getPolicy'>>(
  () => `/api/v1/policies/${props.type}`,
  {
    query: computed(() => (selected.value ? { version: selected.value } : {})),
  }
);
const day = (v: string) => v?.slice(0, 10).replaceAll('-', '.');
</script>
<template>
  <section class="policy-viewer">
    <p v-if="status === 'pending'" role="status">불러오는 중입니다.</p>
    <div v-else-if="error" role="alert">
      <p>정책을 불러올 수 없습니다.</p>
      <button @click="refresh()">다시 시도</button>
    </div>
    <template v-else-if="data">
      <header class="policy-modal-header">
        <span class="policy-kicker">BLARIYO POLICY</span>
        <h1>{{ data.data.policy.title }}</h1>
        <p>
          버전 {{ data.data.policy.version }} · {{ day(data.data.policy.effectiveAt) }}부터 적용
        </p>
      </header>
      <div class="policy-modal-body">
        <div class="policy-body" v-html="data.data.policy.bodyHtml" />
        <section class="policy-history-section" aria-label="정책 이력">
          <h2>정책 이력</h2>
          <p>버전을 선택하면 해당 시점의 전체 내용을 볼 수 있습니다.</p>
          <div class="policy-history-head" aria-hidden="true">
            <span>버전</span><span>적용 기간</span>
          </div>
          <button
            class="policy-history"
            v-for="item in data.data.history"
            :key="item.version"
            :aria-current="data.data.policy.version === item.version ? 'true' : undefined"
            @click="selected = item.version"
          >
            <span>{{ item.version }}</span
            ><span
              >{{ day(item.effectiveAt) }} ~
              {{ item.endedAt ? day(item.endedAt) : '시행 중' }}</span
            >
          </button>
        </section>
      </div>
    </template>
  </section>
</template>
<style scoped>
.policy-body {
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.8;
}
.policy-body :deep(h1:first-child) {
  display: none;
}
.policy-body :deep(h2) {
  font-size: 17px;
  margin: 24px 0 8px;
}
.policy-body :deep(h3) {
  font-size: 15px;
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
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  width: 100%;
  gap: 8px;
  min-height: 58px;
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  text-align: center;
  align-items: center;
  font-size: 12px;
}
.policy-history[aria-current='true'] {
  color: var(--brand-strong);
  background: var(--brand-soft);
  font-weight: 800;
}
.policy-history-section {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 6px solid var(--line);
}
.policy-history-section h2 {
  margin: 0 0 5px;
  font-size: 18px;
}
.policy-history-section p {
  color: var(--muted);
  font-size: 12px;
}
.policy-history-head {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px;
  padding: 10px 14px;
  font-size: 11px;
  text-align: center;
  border-top: 2px solid var(--ink);
  background: #edf0f1;
}
</style>
