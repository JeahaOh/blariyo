<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
type Policy = ApiResponse<'listSourcePublishPolicies'>['data']['items'][number];
type PolicyRow = Policy & { draftCollection: boolean; draftAutoPublish: boolean; saving: boolean; message: string; uncertain: boolean };
const policies = ref<PolicyRow[]>([]), canManage = ref(false), busy = ref(false), loaded = ref(false), loadFailed = ref(false);
const search = ref(''), collectionFilter = ref('all'), publishFilter = ref('all'), errorFilter = ref('all');
const collectionOptions = [{value:'all',label:'전체'}, {value:'on',label:'수집함'}, {value:'off',label:'수집 안 함'}, {value:'unavailable',label:'수집 제한'}, {value:'unknown',label:'설정 미확인'}];
const publishOptions = [{value:'all',label:'전체'}, {value:'on',label:'사용'}, {value:'off',label:'사용 안 함'}];
const errorOptions = [{value:'all',label:'전체'}, {value:'error',label:'오류 있음'}, {value:'clear',label:'오류 없음'}, {value:'none',label:'이력 없음'}];
const publishChoices = [{value:true,label:'사용'}, {value:false,label:'사용 안 함'}];
function hasError(item: PolicyRow) { return item.lastFailureCodes.length > 0 || ['PARTIAL','FAILED','BLOCKED'].includes(item.lastRunState ?? ''); }
const filtered = computed(() => policies.value.filter(item => {
  const keyword = search.value.trim().toLocaleLowerCase();
  return (!keyword || `${item.displayName} ${item.sourceKey} ${item.sourceUrl ?? ''}`.toLocaleLowerCase().includes(keyword))
    && (collectionFilter.value === 'all' || (collectionFilter.value === 'on' && item.collectionEnabled === true)
      || (collectionFilter.value === 'off' && item.collectionEnabled === false) || (collectionFilter.value === 'unavailable' && !item.collectionAvailable)
      || (collectionFilter.value === 'unknown' && item.collectionEnabled === null))
    && (publishFilter.value === 'all' || item.autoPublishEnabled === (publishFilter.value === 'on'))
    && (errorFilter.value === 'all' || (errorFilter.value === 'none' && item.lastRunAt === null)
      || (errorFilter.value === 'error' && hasError(item)) || (errorFilter.value === 'clear' && item.lastRunAt !== null && !hasError(item)));
}));
function resetFilters() { search.value = ''; collectionFilter.value = 'all'; publishFilter.value = 'all'; errorFilter.value = 'all'; }
const runLabels: Record<string,string> = {QUEUED:'대기',RUNNING:'수집 중',COMPLETED:'완료',PARTIAL:'부분 실패',FAILED:'실패',BLOCKED:'차단'};
const failureLabels: Record<string,string> = {
  SOURCE_HTTP_UNAVAILABLE:'원문 서버 응답 오류',SOURCE_ACCESS_BLOCKED:'원문 접근 차단',SOURCE_NOT_ALLOWED:'수집 정책 제한',SOURCE_DISABLED:'수집 중지',SOURCE_URL_INVALID:'원문 주소 형식 오류',
  PARSE_FAILED:'본문 분석 실패',SOURCE_PARSE_FAILED:'본문 분석 실패',IMAGE_PARSE_FAILED:'이미지 주소 분석 실패',SOURCE_FETCH_FAILED:'원문 가져오기 실패',SOURCE_DNS_FAILED:'사이트 주소 연결 실패',SOURCE_NOT_IMAGE:'이미지가 아닌 응답',IMAGE_FETCH_FAILED:'이미지 가져오기 실패',IMAGE_HOST_DEFERRED:'이미지 서버 대기 중',SOURCE_HTTP_REJECTED:'서버 요청 거절',SOURCE_LIST_PARSE_FAILED:'목록 분석 실패',SOURCE_DATE_UNKNOWN:'게시 시각 미확인',
  SOURCE_REQUEST_BUDGET_EXCEEDED:'요청 한도 초과',CHART_UNVERIFIED:'게시판 수집 미검증',IMAGE_HTTP_UNAVAILABLE:'이미지 서버 응답 오류',
  IMAGE_URL_NOT_ALLOWED:'이미지 URL 제한',IMAGE_TYPE_NOT_ALLOWED:'이미지 형식 제한',IMAGE_TOO_LARGE:'이미지 크기 초과',
  BATCH_OWNER_LOST:'수집 프로세스 연결 끊김',DEPENDENCY_UNAVAILABLE:'외부 저장소 연결 오류',
};
const dateFormatter = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function date(value: string) { return dateFormatter.format(new Date(value)); }
const saving = computed(() => policies.value.some(item => item.saving));
function row(item: Policy): PolicyRow {
  return { ...item, draftCollection: item.collectionEnabled ?? false, draftAutoPublish: item.autoPublishEnabled, saving: false, message: '', uncertain: false };
}
function changed(item: PolicyRow) {
  return item.autoPublishEnabled !== item.draftAutoPublish || (item.collectionEnabled !== null && item.collectionEnabled !== item.draftCollection);
}
async function reload() {
  if (busy.value || saving.value) return;
  busy.value = true;
  try {
    const result = await $fetch<ApiResponse<'listSourcePublishPolicies'>>('/api/v1/admin/collect/source-publish-policies',{retry:0});
    policies.value = result.data.items.map(row); canManage.value = result.data.canManage;
    loaded.value = true; loadFailed.value = false;
  } catch {
    loaded.value = false; loadFailed.value = true; canManage.value = false;
  } finally { busy.value = false; }
}
onMounted(reload);
useUiLoading(() => busy.value || saving.value);
async function save(item: PolicyRow) {
  if (!loaded.value || !canManage.value || busy.value || item.saving || item.uncertain || !changed(item)) return;
  const requested = item.draftAutoPublish;
  item.saving = true; item.message = '';
  try {
    const result = await $fetch<ApiResponse<'updateSourcePublishPolicy'>>(`/api/v1/admin/collect/source-publish-policies/${item.sourceKey}`,{
      method:'POST',retry:0,body:{autoPublishEnabled:requested,lockVersion:item.lockVersion,
        ...(item.collectionEnabled === null ? {} : {collectionEnabled:item.draftCollection,collectionLockVersion:item.collectionLockVersion})},
    });
    Object.assign(item,row(result.data));
    item.message = '저장했습니다.';
  } catch (error) {
    item.message = ['SOURCE_PUBLISH_POLICY_VERSION_CONFLICT','SOURCE_COLLECTION_SETTING_VERSION_CONFLICT'].includes(apiError(error).code ?? '')
      ? '다른 관리자가 변경했습니다. 최신 값을 확인한 뒤 다시 저장해 주세요.'
      : '저장 결과를 확인하지 못했습니다. 최신 값을 확인해 주세요.';
    try {
      const latest = await $fetch<ApiResponse<'listSourcePublishPolicies'>>('/api/v1/admin/collect/source-publish-policies',{retry:0});
      const current = latest.data.items.find(value => value.sourceKey === item.sourceKey);
      if (!current) throw new Error('SOURCE_SETTING_MISSING');
      const message = item.message;
      Object.assign(item,row(current),{message});
      canManage.value = latest.data.canManage;
    } catch { item.uncertain = true; item.message += ' 다시 조회가 필요합니다.'; }
  } finally { item.saving = false; }
}
</script>
<template>
  <section class="source-publish-policies" aria-label="수집처 설정">
    <div class="list-heading">
      <h2>수집처 목록<span v-if="loaded" class="source-count">{{ filtered.length }} / {{ policies.length }}개</span></h2>
      <button :disabled="busy || saving" @click="reload">다시 조회</button>
    </div>
    <div v-if="loaded" class="source-filters" role="search" aria-label="수집처 필터">
      <label class="search-filter">수집처 검색<input v-model="search" type="search" placeholder="이름 또는 URL" /></label>
      <label>수집 여부<SourceSettingSelect v-model="collectionFilter" :options="collectionOptions" label="수집 여부 필터" /></label>
      <label>자동 발행<SourceSettingSelect v-model="publishFilter" :options="publishOptions" label="자동 발행 필터" /></label>
      <label>최근 수집 오류<SourceSettingSelect v-model="errorFilter" :options="errorOptions" label="최근 수집 오류 필터" /></label>
      <button class="reset-filters" @click="resetFilters">초기화</button>
    </div>
    <p v-if="loaded && !canManage">설정 변경은 소유자만 할 수 있습니다.</p>
    <p v-if="loadFailed" role="alert">수집처 설정을 불러오지 못했습니다. 다시 조회해 주세요.</p>
    <p v-if="busy" role="status">설정을 불러오는 중…</p>
    <div v-if="loaded && filtered.length" class="table-scroll">
      <table>
        <colgroup><col class="name-column"><col><col class="history-column"><col class="setting-column"><col class="setting-column"><col class="save-column"></colgroup>
        <thead><tr><th scope="col">수집처</th><th scope="col">수집처 URL</th><th scope="col">수집 이력</th><th scope="col">수집 여부</th><th scope="col">자동 발행 여부</th><th scope="col">저장</th></tr></thead>
        <tbody><tr v-for="item in filtered" :key="item.sourceKey" :class="{ 'is-changed': changed(item) }">
          <th scope="row">{{ item.displayName }}</th>
          <td class="source-url"><a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">{{ item.sourceUrl }}</a><span v-else>미등록</span></td>
          <td class="history-cell">
            <div v-if="item.lastCollectedAt" class="last-collected">마지막 수집<time :datetime="item.lastCollectedAt">{{ date(item.lastCollectedAt) }}</time></div>
            <span v-else-if="item.lastRunAt" class="no-collection">정상 수집 이력 없음</span>
            <div v-if="item.lastRunAt" class="last-run">
              <span class="run-state" :class="{ 'has-error': hasError(item) }">{{ runLabels[item.lastRunState ?? ''] ?? item.lastRunState }}</span>
              <time :datetime="item.lastRunAt" title="최근 배치 시작 시각 · 한국 시간">{{ date(item.lastRunAt) }}</time>
            </div>
            <span v-else class="no-run">수집 이력 없음</span>
            <ul v-if="item.lastFailureCodes.length" class="failure-reasons" aria-label="최근 실행 실패 사유">
              <li v-for="code in item.lastFailureCodes" :key="code"><span v-if="failureLabels[code]">{{ failureLabels[code] }}</span><code>{{ code }}</code></li>
            </ul>
            <small v-else-if="hasError(item)">실패 사유 미기록</small>
          </td>
          <td class="setting-cell">
            <span class="mobile-label" aria-hidden="true">수집 여부</span>
            <div class="policy-control"><SourceSettingSelect v-model="item.draftCollection" :enabled="item.draftCollection" :label="`${item.displayName} 수집 여부`"
              :disabled="busy || item.saving || item.uncertain || !canManage || item.collectionEnabled === null"
              :options="[{value:true,label:'수집함',disabled:!item.collectionAvailable},{value:false,label:'수집 안 함'}]" /></div>
            <small v-if="item.collectionEnabled === null">설정 미확인</small>
            <small v-else-if="!item.collectionAvailable">수집 제한</small>
          </td>
          <td class="setting-cell">
            <span class="mobile-label" aria-hidden="true">자동 발행 여부</span>
            <div class="policy-control"><SourceSettingSelect v-model="item.draftAutoPublish" :enabled="item.draftAutoPublish" :label="`${item.displayName} 자동 발행 여부`"
              :disabled="busy || item.saving || item.uncertain || !canManage" :options="publishChoices" /></div>
          </td>
          <td class="save-cell">
            <button v-if="canManage" :aria-label="`${item.displayName} 저장`" :disabled="busy || item.saving || item.uncertain || !changed(item)" @click="save(item)">{{ item.saving ? '저장 중…' : '저장' }}</button>
            <span v-else>조회 전용</span>
            <small v-if="item.message" role="status">{{ item.message }}</small>
          </td>
        </tr></tbody>
      </table>
    </div>
    <p v-else-if="loaded">{{ policies.length ? '조건에 맞는 수집처가 없습니다.' : '등록된 수집처가 없습니다.' }}</p>
  </section>
</template>
<style scoped>
.source-publish-policies { margin: 0; border: 1px solid var(--line); border-radius: 12px; background: #fff; overflow: hidden; }
.list-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 18px 20px; border-bottom: 1px solid var(--line); }
.list-heading h2 { display: flex; align-items: center; gap: 10px; margin: 0; padding: 0; border: 0; font-size: 16px; font-weight: 700; }
.source-count { padding: 2px 8px; border-radius: 6px; background: #edf3f4; color: var(--muted); font-size: 12px; font-weight: 600; }
.list-heading button { padding: 8px 12px; border-color: var(--line); background: #fff; font-size: 13px; }
.source-publish-policies > p { margin: 16px 20px; font-size: 14px; }
.mobile-label { display: none; }
.policy-control { width: 136px; margin-inline: auto; }
.source-filters { display: grid; grid-template-columns: minmax(160px, 1.5fr) repeat(3, minmax(120px, 1fr)) auto; align-items: end; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
.source-filters label { margin: 0; display: grid; gap: 6px; min-width: 0; color: var(--muted); font-size: 12px; }
.source-filters input { width: 100%; min-height: 44px; font-size: 14px; }
.reset-filters { min-height: 44px; padding: 8px 12px; border-color: var(--line); background: #fff; font-size: 13px; }
.history-column { width: 200px; }
.history-cell { font-size: 12px; }
.last-collected { color: var(--muted); }
.last-collected time { display: block; color: var(--ink); font-size: 13px; }
.last-run { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; color: var(--muted); font-size: 11px; }
.run-state { padding: 1px 5px; border-radius: 4px; background: #eef4f3; color: var(--brand-strong); }
.run-state.has-error { background: #fff0eb; color: #a54027; }
.no-collection, .no-run { display: block; color: var(--muted); }
.no-run { margin-top: 6px; }
.failure-reasons { margin: 8px 0 0; padding: 0; list-style: none; color: #a54027; }
.failure-reasons li + li { margin-top: 5px; }
.failure-reasons code { display: block; font-family: inherit; font-size: 10px; overflow-wrap: anywhere; }
button { min-height: 44px; }
.table-scroll { overflow-x: auto; }
table { width: 100%; min-width: 900px; border-collapse: collapse; table-layout: fixed; }
.name-column { width: 110px; }
.setting-column { width: 148px; }
.save-column { width: 96px; }
th, td { padding: 14px 12px; border-bottom: 1px solid #e7edef; text-align: left; vertical-align: top; }
thead th { padding-block: 12px; background: #f7f9fa; color: var(--muted); font-size: 12px; font-weight: 600; }
thead th:first-child, tbody th { padding-left: 20px; }
thead th:nth-child(n+4) { text-align: center; }
tbody th { padding-top: 24px; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
tbody tr:last-child > * { border-bottom: 0; }
tbody tr:hover { background: #fafcfc; }
tbody tr.is-changed { background: #f0faf9; }
.source-url { padding-top: 24px; font-size: 13px; color: var(--muted); }
.source-url a { overflow-wrap: anywhere; }
.source-url a:hover { color: var(--brand-strong); }
.setting-cell { text-align: center; }
.save-cell { text-align: center; }
.source-publish-policies .save-cell button { width: 72px; padding: 8px 10px; border-color: var(--brand-strong); background: var(--brand-strong); color: #fff; font-size: 13px; font-weight: 600; white-space: nowrap; }
.source-publish-policies .save-cell button:disabled { border-color: var(--line); background: #f7f9fa; color: #89959b; opacity: 1; }
.source-publish-policies .save-cell button:hover:not(:disabled) { background: #006a67; }
.save-cell > span { font-size: 12px; color: var(--muted); }
small { display: block; margin-top: 6px; font-size: 12px; color: var(--muted); }
.save-cell small { text-align: left; overflow-wrap: anywhere; }
@media (max-width: 1100px) { .source-filters { grid-template-columns: repeat(3, minmax(0, 1fr)); } .search-filter { grid-column: 1 / 3; } }
@media (max-width: 600px) {
  .source-publish-policies { border-radius: 10px; }
  .list-heading { padding: 14px 16px; }
  .table-scroll { overflow: visible; }
  table, tbody { display: block; min-width: 0; }
  colgroup { display: none; }
  thead { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; padding: 18px 16px; border-bottom: 1px solid #e7edef; }
  tbody tr:last-child { border-bottom: 0; }
  tbody th, tbody td { display: block; padding: 0; border: 0; text-align: left; }
  tbody th { grid-column: 1 / -1; padding: 0; font-size: 15px; }
  .source-url { grid-column: 1 / -1; margin-top: -8px; font-size: 12px; }
  .mobile-label { display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted); }
  .policy-control { width: 100%; }
  .source-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 14px 16px; }
  .search-filter { grid-column: 1 / -1; }
  .reset-filters { align-self: end; }
  .history-cell { grid-column: 1 / -1; padding: 10px 0; border-block: 1px solid #edf1f2; }
  .last-collected { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .last-run { margin-top: 4px; }
  .save-cell { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
  .save-cell small { flex: 1; order: -1; margin: 0; }
}
[role='alert'] { color: #a12622; }
</style>
