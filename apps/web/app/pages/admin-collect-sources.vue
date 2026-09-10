<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
import type { components } from '@blariyo/contracts/collection-api';
definePageMeta({ path: '/admin/collect/sources' });
const requestFetch = useRequestFetch();
const { data: sources, error } = await useAsyncData('collect-sources', () =>
  requestFetch<ApiResponse<'listCollectionSources'>>('/api/v1/admin/collect/sources')
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    message: '수집 출처를 사용할 수 없습니다.',
  });
const busy = ref(false),
  message = ref('');
async function save(s: components['schemas']['CollectionSource']) {
  if (busy.value) return;
  busy.value = true;
  try {
    const r = await $fetch<ApiResponse<'updateCollectionSource'>>(
      `/api/v1/admin/collect/sources/${s.sourceId}`,
      {
        method: 'PATCH',
        body: {
          lockVersion: s.lockVersion,
          isActive: s.isActive,
          robotsAllowed: s.robotsAllowed,
          requestIntervalMs: s.requestIntervalMs,
          dailyFetchLimit: s.dailyFetchLimit,
        },
        retry: 0,
      }
    );
    Object.assign(s, r.data);
    message.value = '저장했습니다.';
  } catch (e) {
    message.value =
      apiError(e).code === 'SOURCE_VERSION_CONFLICT'
        ? '다른 변경이 있습니다. 화면을 새로고침해 주세요.'
        : '저장하지 못했습니다.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main v-if="sources">
    <h1>수집 출처</h1>
    <NuxtLink to="/admin/collect">후보 검수로 돌아가기</NuxtLink>
    <p role="status">{{ message }}</p>
    <p>접근 조건과 추출 규칙을 확인한 출처만 등록합니다. 목록 자동 수집은 지원하지 않습니다.</p>
    <p v-if="!sources.data.items.length">등록된 출처가 없습니다.</p>
    <form v-for="s in sources.data.items" :key="s.sourceId" @submit.prevent="save(s)">
      <fieldset :disabled="busy">
        <legend>{{ s.name }} · {{ s.host }}</legend>
        <label><input v-model="s.isActive" type="checkbox" />수집 활성화</label
        ><label
          >robots 확인 결과<select v-model="s.robotsAllowed">
            <option :value="null">미확인</option>
            <option :value="true">허용 확인</option>
            <option :value="false">금지 확인</option>
          </select></label
        ><label
          >요청 간격(ms)<input
            v-model.number="s.requestIntervalMs"
            type="number"
            min="1000"
            required /></label
        ><label
          >하루 요청 한도<input
            v-model.number="s.dailyFetchLimit"
            type="number"
            min="1"
            max="10000"
            required
        /></label>
        <p>최근 오류: {{ s.lastErrorCode || '없음' }}</p>
        <button>저장</button>
      </fieldset>
    </form>
  </main>
</template>
<style scoped>
fieldset {
  margin: 20px 0;
}
label {
  display: block;
  margin: 12px 0;
}
</style>
