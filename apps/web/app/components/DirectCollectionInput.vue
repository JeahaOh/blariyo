<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
type RequestState = ApiResponse<'getDirectCollectionRequest'>['data'];
type SourceState = ApiResponse<'listRuntimeCollectionSources'>['data']['items'][number];
const emit = defineEmits<{ collected: [itemId: string] }>();
defineProps<{ reviewEnabled: boolean }>();
const route = useRoute(), router = useRouter();
const url = ref(''), request = ref<RequestState | null>(null), sources = ref<SourceState[]>([]);
const busy = ref(false), checking = ref(false), sourceLoading = ref(true), message = ref(''), sourceError = ref('');
const pending = ref<{ key: string; path: string; body: { url: string } | { expectedVersion: number } } | null>(null);
const statusHeading = ref<HTMLElement | null>(null);
const urlInput = ref<HTMLInputElement | null>(null);
function time(value: string | null) { return value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '미확인'; }
const states: Record<RequestState['state'], string> = { PENDING: '접수됨', ACCEPTED: '수집 대기', RUNNING: '수집 중',
  SUCCEEDED: '수집 완료', FAILED: '수집 실패', BLOCKED: '수집 제한', DUPLICATE: '이미 수집한 원문', EXPIRED: '요청 기한 만료' };
const freshness: Record<SourceState['freshness'], string> = { CURRENT: '실행 설정 확인됨', STALE: '실행 확인이 오래됨',
  ABSENT: '실행 설정 미확인', CONFLICT: '실행 설정 충돌' };
const progress = computed(() => request.value && ['PENDING', 'ACCEPTED', 'RUNNING'].includes(request.value.state));
let timer: ReturnType<typeof setTimeout> | undefined, runtimeTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const abort = new AbortController();
function describe(error: unknown) {
  const code = apiError(error).code;
  const messages: Record<string, string> = { VALIDATION_FAILED: '지원하는 HTTPS 원문 주소를 확인해 주세요.', SOURCE_UNSUPPORTED: '지원하지 않는 출처입니다.',
    SOURCE_DISABLED: '현재 수집이 허용되지 않은 출처입니다.', RATE_LIMITED: '접수 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
    REQUEST_VERSION_CONFLICT: '처리 상태가 바뀌었습니다. 현재 상태를 다시 확인해 주세요.', REQUEST_RETRY_NOT_ALLOWED: '다시 수집할 수 없는 요청입니다.',
    COLLECTION_REQUEST_NOT_FOUND: '요청 기록이 없거나 보관 기한이 지났습니다.', COLLECTION_UNAVAILABLE: '수집 설정이나 연결을 확인하지 못했습니다.',
    ADMIN_FORBIDDEN: '이 작업을 수행할 권한이 없습니다.', ADMIN_AUTH_REQUIRED: '다시 로그인해 주세요.' };
  return code && messages[code] ? messages[code] : '처리 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.';
}
async function execute() {
  const command = pending.value; if (!command || busy.value) return;
  busy.value = true; message.value = '';
  try {
    const result = await $fetch<ApiResponse<'createDirectCollectionRequest'>>(command.path, { method: 'POST', body: command.body,
      headers: { 'Idempotency-Key': command.key }, retry: 0, signal: abort.signal });
    if (disposed) return;
    request.value = result.data; pending.value = null; url.value = '';
    await router.replace({ query: { ...route.query, request: result.data.requestId } });
    await nextTick(); statusHeading.value?.focus();
  } catch (error) {
    if (disposed) return;
    const code = apiError(error).code;
    if (code && ['VALIDATION_FAILED', 'SOURCE_UNSUPPORTED', 'SOURCE_DISABLED', 'REQUEST_VERSION_CONFLICT', 'REQUEST_RETRY_NOT_ALLOWED',
      'IDEMPOTENCY_CONFLICT', 'DEDUP_IDENTITY_CONFLICT', 'RATE_LIMITED'].includes(code)) pending.value = null;
    message.value = describe(error);
  } finally {
    busy.value = false;
    if (!disposed && message.value && !pending.value) { await nextTick(); urlInput.value?.focus(); }
  }
}
async function submit() {
  if (busy.value || pending.value) return;
  pending.value = { key: crypto.randomUUID(), path: '/api/admin/collect/requests', body: { url: url.value } };
  await execute();
}
async function retry() {
  if (!request.value?.retryable || busy.value || pending.value) return;
  pending.value = { key: crypto.randomUUID(), path: `/api/admin/collect/requests/${request.value.requestId}/retry`, body: { expectedVersion: request.value.version } };
  await execute();
}
async function refresh() {
  const id = request.value?.requestId ?? (typeof route.query.request === 'string' ? route.query.request : null);
  if (!id || !/^[a-f0-9-]{36}$/i.test(id) || checking.value || disposed) return;
  checking.value = true;
  try {
    const result = await $fetch<ApiResponse<'getDirectCollectionRequest'>>(`/api/admin/collect/requests/${id}`, { retry: 0, signal: abort.signal });
    if (!disposed && (!request.value || request.value.requestId === id)) { request.value = result.data; if (!pending.value) message.value = ''; }
  } catch (error) {
    if (disposed) return;
    message.value = describe(error);
    if (apiError(error).code === 'COLLECTION_REQUEST_NOT_FOUND') { request.value = null; await router.replace({ query: { ...route.query, request: undefined } }); }
  } finally { checking.value = false; }
}
async function runtime() {
  sourceLoading.value = true;
  try {
    const result = await $fetch<ApiResponse<'listRuntimeCollectionSources'>>('/api/admin/collect/runtime-sources', { retry: 0, signal: abort.signal });
    if (!disposed) { sources.value = result.data.items; sourceError.value = ''; }
  } catch (error) { if (!disposed) { sources.value = []; sourceError.value = describe(error); } }
  finally { sourceLoading.value = false; }
}
async function poll() {
  if (!document.hidden && progress.value) await refresh();
  if (!disposed) timer = setTimeout(() => { void poll(); }, 5000);
}
async function pollRuntime() {
  if (!document.hidden) await runtime();
  if (!disposed) runtimeTimer = setTimeout(() => { void pollRuntime(); }, 30000);
}
function leaving(event: BeforeUnloadEvent) { if (pending.value || busy.value) { event.preventDefault(); event.returnValue = ''; } }
onMounted(() => { void refresh(); void poll(); void pollRuntime(); window.addEventListener('beforeunload', leaving); });
onBeforeRouteLeave(() => !pending.value && !busy.value);
onUnmounted(() => { disposed = true; abort.abort(); clearTimeout(timer); clearTimeout(runtimeTimer); window.removeEventListener('beforeunload', leaving); });
</script>
<template>
  <section class="direct-input" aria-labelledby="direct-title">
    <h2 id="direct-title">원문 URL 수집 요청</h2>
    <p>접수 후 수집기가 처리합니다. 수집 완료 뒤 원문을 검수해 주세요.</p>
    <form @submit.prevent="submit">
      <label for="direct-url">원문 HTTPS 주소</label>
      <input id="direct-url" ref="urlInput" v-model="url" type="url" required maxlength="2048" autocomplete="off" :disabled="busy || !!pending" />
      <button :disabled="busy || !!pending">수집 요청</button>
    </form>
    <p v-if="message" role="alert">{{ message }}</p>
    <button v-if="pending" :disabled="busy" @click="execute">같은 요청으로 결과 확인</button>
    <section v-if="request" aria-labelledby="direct-status">
      <h3 id="direct-status" ref="statusHeading" tabindex="-1">요청 상태</h3>
      <p role="status">{{ states[request.state] }}</p>
      <p>{{ freshness[request.configFreshness] }}</p>
      <p>접수 {{ time(request.requestedAt) }} · 요청 기한 {{ time(request.acceptBefore) }} (한국 시간)</p>
      <p>마지막 상태 변경 {{ time(request.updatedAt) }}</p>
      <p v-if="request.errorCode">처리 사유: {{ request.errorCode }}</p>
      <p v-if="request.state === 'PENDING'">아직 수집기가 수락하지 않았습니다. 접수 후 24시간 안에 처리되지 않으면 만료됩니다.</p>
      <p v-if="request.state === 'EXPIRED'">수집하지 못한 요청이 종료됐습니다. 출처 설정과 수집기 상태를 확인해 주세요.</p>
      <p v-if="request.state === 'DUPLICATE'">{{ request.itemId ? '이미 수집한 원문입니다.' : '이미 수집한 원문이며 현재 열 수 있는 보관 자료가 없습니다.' }}</p>
      <button :disabled="checking || busy" @click="refresh">상태 다시 확인</button>
      <button v-if="request.retryable" :disabled="busy || !!pending" @click="retry">실패한 수집 다시 요청</button>
      <button v-if="reviewEnabled && ['SUCCEEDED', 'DUPLICATE'].includes(request.state) && request.itemId" @click="emit('collected', request.itemId)">수집 결과 열기</button>
    </section>
    <details>
      <summary>출처 실행 설정 확인</summary>
      <p>수집기가 실제 로딩한 설정입니다. 이 화면에서는 변경할 수 없습니다.</p>
      <p v-if="sourceError" role="alert">{{ sourceError }}</p>
      <button :disabled="sourceLoading" @click="runtime">실행 설정 다시 조회</button>
      <p v-if="sourceLoading" aria-live="polite">실행 설정을 확인하고 있습니다.</p>
      <p v-else-if="!sourceError && !sources.length">등록된 출처가 없습니다.</p>
      <ul>
        <li v-for="source in sources" :key="source.sourceKey">
          <strong>{{ source.sourceKey }}</strong> — {{ freshness[source.freshness] }}
          <p v-if="source.freshness === 'ABSENT'">적용 중인 설정을 아직 확인하지 못했습니다.</p>
          <template v-else>
            <p v-if="source.freshness === 'STALE'">마지막 관측값입니다. 현재 적용 여부는 확인되지 않았습니다.</p>
            <p>{{ source.enabled ? '수집 허용' : '수집 비활성' }} · 허용 호스트: {{ source.allowedHosts?.join(', ') }}</p>
            <p>수집 정책: {{ source.collectionPolicy }}<template v-if="source.blockedReason"> · 제한 사유: {{ source.blockedReason }}</template></p>
            <p>요청 간격 {{ source.requestIntervalMs === null ? '미확인' : `${source.requestIntervalMs / 1000}초` }} · 하루 상한 {{ source.dailyRequestLimit ?? '미설정' }}회</p>
            <p>최대 {{ source.maxPages }}페이지 · {{ source.maxItems }}건 · 이미지 {{ source.mediaLimits?.maxImages }}개</p>
            <p>파일 한도 {{ source.mediaLimits?.maxFileBytes }} bytes · 합계 {{ source.mediaLimits?.maxTotalBytes }} bytes</p>
            <p>설정 적용 {{ time(source.loadedAt) }} · 마지막 관측 {{ time(source.observedAt) }} (한국 시간)</p>
            <p>설정 버전 {{ source.configVersion }} · 정규화 버전 {{ source.normalizationVersion }}</p>
          </template>
        </li>
      </ul>
    </details>
  </section>
</template>
<style scoped>
.direct-input { border-block: 1px solid #ddd; padding-block: 20px; margin-block: 24px; overflow-wrap: anywhere; }
form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
label { width: 100%; }
input { flex: 1 1 240px; min-width: 0; }
input, button { box-sizing: border-box; max-width: 100%; padding: 10px 12px; }
button { margin: 4px; }
details { margin-top: 20px; }
li { margin-block: 16px; }
</style>
