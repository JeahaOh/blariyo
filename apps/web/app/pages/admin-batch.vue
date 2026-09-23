<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
definePageMeta({ path: '/admin/batch' });
type Decision = 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'DRAFT';
type Filters = { source: string; state: string; reviewStatus: string };
const requestFetch = useRequestFetch();
const { data: listing, error } = await useAsyncData('batch-review-list', () =>
  requestFetch<ApiResponse<'listBatchItems'>>('/api/v1/admin/collect/batch-items')
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    message: '수집 결과를 불러올 수 없습니다.',
  });
const page = ref(1),
  source = ref(''),
  state = ref(''),
  reviewStatus = ref('');
const busy = ref(false),
  message = ref(''),
  listError = ref(''),
  title = ref('');
const appliedFilters = ref<Filters>({ source: '', state: '', reviewStatus: '' });
const selected = ref<ApiResponse<'getBatchItem'>['data']['item'] | null>(null);
const pending = ref<{
  itemId: string;
  path: string;
  body: Record<string, string | number>;
  key: string;
  decision: Decision;
  confirmed: boolean;
} | null>(null);
const locked = computed(() => busy.value || pending.value !== null);
const collectionLabels: Record<string, string> = {
  DISCOVERED: '수집 대기',
  FETCHING: '수집 중',
  FETCHED: '수집 완료',
  FAILED: '수집 실패',
  BLOCKED: '접근 제한',
  SKIPPED_DUPLICATE: '중복 제외',
  SKIPPED_POLICY: '기간 조건 제외',
};
const labels: Record<string, string> = {
  UNREVIEWED: '검수 전',
  REVIEWING: '검수 중',
  APPROVED: '승인',
  REJECTED: '반려',
};
async function fetchList(n: number, filters: Filters) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const load = (page: number) =>
    $fetch<ApiResponse<'listBatchItems'>>('/api/v1/admin/collect/batch-items', {
      query: { page, ...query },
      retry: 0,
    });
  let result = await load(n);
  if (n > result.data.totalPages) result = await load(result.data.totalPages);
  listing.value = result;
  page.value = result.data.page;
  appliedFilters.value = { ...filters };
  listError.value = '';
}
async function refresh(n = page.value, apply = false) {
  if (locked.value) return;
  busy.value = true;
  try {
    await fetchList(
      n,
      apply
        ? { source: source.value.trim(), state: state.value, reviewStatus: reviewStatus.value }
        : appliedFilters.value
    );
  } catch {
    listError.value = '목록을 불러오지 못했습니다. 현재 목록을 유지합니다. 다시 조회해 주세요.';
  } finally {
    busy.value = false;
  }
}
async function open(id: string) {
  if (locked.value) return;
  busy.value = true;
  message.value = '';
  try {
    selected.value = (
      await $fetch<ApiResponse<'getBatchItem'>>(`/api/v1/admin/collect/batch-items/${id}`, {
        retry: 0,
      })
    ).data.item;
    title.value = selected.value.title || '';
  } catch {
    message.value = '상세를 불러오지 못했습니다. 수집 결과와 본문 형식을 확인해 주세요.';
  } finally {
    busy.value = false;
  }
}
async function decide(decision: Decision) {
  const item = selected.value;
  if (!item || locked.value) return;
  pending.value = {
    itemId: item.itemId,
    path: `/api/v1/admin/collect/batch-items/${item.itemId}/${decision === 'DRAFT' ? 'draft' : 'review'}`,
    body: {
      itemVersion: item.version,
      lockVersion: item.review.lockVersion,
      ...(decision === 'DRAFT' ? { boardSlug: 'meme', title: title.value } : { decision }),
    },
    key: crypto.randomUUID(),
    decision,
    confirmed: false,
  };
  await executePending();
}
async function executePending() {
  const request = pending.value;
  if (!request || busy.value) return;
  busy.value = true;
  message.value = '';
  try {
    const options = {
      method: 'POST' as const,
      body: request.body,
      headers: { 'Idempotency-Key': request.key },
      retry: 0,
    };
    let savedMessage = '검수 상태를 저장했습니다.';
    if (request.decision === 'DRAFT') {
      const result = await $fetch<ApiResponse<'promoteBatchItem'>>(request.path, options);
      savedMessage = `초안 ${result.data.postId}번을 만들었습니다. 게시글 관리에서 확인 후 별도로 발행하세요.`;
    } else await $fetch<ApiResponse<'reviewBatchItem'>>(request.path, options);
    request.confirmed = true;
    selected.value = (
      await $fetch<ApiResponse<'getBatchItem'>>(
        `/api/v1/admin/collect/batch-items/${request.itemId}`,
        { retry: 0 }
      )
    ).data.item;
    pending.value = null;
    message.value = savedMessage;
    // The command and detail are confirmed. A list failure must not turn this into an uncertain save.
    try {
      await fetchList(page.value, appliedFilters.value);
    } catch {
      listError.value =
        '저장은 완료했지만 목록을 새로 불러오지 못했습니다. 목록을 다시 조회해 주세요.';
    }
  } catch (error) {
    const code = apiError(error).code;
    const definitive =
      code &&
      [
        'VALIDATION_FAILED',
        'UPLOAD_TOO_LARGE',
        'UNSUPPORTED_MEDIA_TYPE',
        'IDEMPOTENCY_CONFLICT',
        'BATCH_DUPLICATE_POST',
        'BATCH_ALREADY_PROMOTED',
        'BATCH_CONTENT_INVALID',
        'BATCH_ITEM_NOT_FOUND',
        'BATCH_ITEM_STATE_CONFLICT',
        'BATCH_ITEM_VERSION_CONFLICT',
        'BATCH_REVIEW_STATE_CONFLICT',
        'BATCH_REVIEW_VERSION_CONFLICT',
        'BATCH_MEDIA_CHECKSUM_MISMATCH',
        'BATCH_MEDIA_INCOMPLETE',
        'BATCH_MEDIA_NOT_FOUND',
      ].includes(code);
    if (!request.confirmed && definitive) pending.value = null;
    message.value = pending.value
      ? '처리 결과를 확인하지 못했습니다. 인증과 연결 상태를 확인한 뒤 같은 요청으로 다시 확인해 주세요.'
      : code === 'BATCH_DUPLICATE_POST'
        ? '이미 같은 원문의 게시글이 있습니다.'
        : code === 'BATCH_ITEM_VERSION_CONFLICT' || code === 'BATCH_REVIEW_VERSION_CONFLICT'
          ? '수집 내용 또는 검수 상태가 바뀌었습니다. 상세를 다시 열고 검수해 주세요.'
          : '처리하지 못했습니다. 원문·이미지와 최신 검수 상태를 확인해 주세요.';
  } finally {
    busy.value = false;
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!locked.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(() => !locked.value);
</script>
<template>
  <main class="batch-admin">
    <h1>수집 결과 검수</h1>
    <AdminNavigation />
    <p>원문과 첨부를 확인한 뒤 승인하세요. 초안을 만들어도 자동으로 발행되지 않습니다.</p>
    <form @submit.prevent="refresh(1, true)">
      <label>출처 <input v-model="source" :disabled="locked" placeholder="예: theqoo" /></label>
      <label
        ><span id="batch-state-label">수집 상태</span
        ><select aria-labelledby="batch-state-label" v-model="state" :disabled="locked">
          <option value="">전체</option>
          <option v-for="(label, key) in collectionLabels" :key="key" :value="key">
            {{ label }}
          </option>
        </select></label
      >
      <label
        ><span id="batch-review-label">검수 상태</span
        ><select aria-labelledby="batch-review-label" v-model="reviewStatus" :disabled="locked">
          <option value="">전체</option>
          <option v-for="(label, key) in labels" :key="key" :value="key">{{ label }}</option>
        </select></label
      >
      <button :disabled="locked">조회</button>
    </form>
    <p role="status">{{ message }}</p>
    <div v-if="pending" role="alert">
      <p>처리 결과 확인이 끝날 때까지 이 화면을 유지해 주세요.</p>
      <button :disabled="busy" @click="executePending">처리 결과 다시 확인</button>
    </div>
    <div v-if="listError" role="alert">
      <p>{{ listError }}</p>
      <button :disabled="locked" @click="refresh()">목록 다시 조회</button>
    </div>
    <p>총 {{ listing?.data.totalItems || 0 }}건</p>
    <p v-if="!listing?.data.items.length">조건에 맞는 수집 결과가 없습니다.</p>
    <ul class="batch-list">
      <li v-for="item in listing?.data.items" :key="item.itemId">
        <button type="button" :disabled="locked" @click="open(item.itemId)">
          {{ item.title || '제목 없음' }}
        </button>
        <span
          >{{ item.sourceKey }} · {{ collectionLabels[item.state] || item.state }} ·
          {{ labels[item.review.status]
          }}{{ item.review.postId ? ` · 초안/게시글 ${item.review.postId}` : '' }}</span
        >
      </li>
    </ul>
    <nav aria-label="수집 결과 페이지">
      <button :disabled="locked || page <= 1" @click="refresh(page - 1)">이전</button
      ><span>{{ page }} / {{ listing?.data.totalPages }}</span
      ><button
        :disabled="locked || page >= (listing?.data.totalPages || 1)"
        @click="refresh(page + 1)"
      >
        다음
      </button>
    </nav>
    <section v-if="selected" class="batch-detail" aria-label="수집 결과 상세">
      <h2>{{ selected.title || '제목을 가져오지 못한 글' }}</h2>
      <a :href="selected.canonicalUrl" target="_blank" rel="noopener noreferrer">원문 확인 ↗</a>
      <p>
        {{ collectionLabels[selected.state] || selected.state }} ·
        {{ labels[selected.review.status] }}
      </p>
      <p v-if="selected.failureCode" role="status">
        수집하지 못했습니다. 원문 상태를 확인해 주세요. ({{ selected.failureCode }})
      </p>
      <p v-if="selected.skipReason === 'SOURCE_DATE_UNKNOWN'">
        작성 시각을 확인할 수 없어 기간 조건에 따라 제외했습니다.
      </p>
      <p v-else-if="selected.skipReason === 'SOURCE_OUTSIDE_WINDOW'">
        설정한 수집 기간에 포함되지 않아 제외했습니다.
      </p>
      <div class="actions">
        <button
          :disabled="locked || selected.state !== 'FETCHED' || !!selected.review.postId"
          @click="decide('REVIEWING')"
        >
          검수 시작 / 다시 검수
        </button>
        <button
          :disabled="
            locked ||
            selected.state !== 'FETCHED' ||
            selected.review.status !== 'REVIEWING' ||
            !!selected.review.postId
          "
          @click="decide('REJECTED')"
        >
          반려
        </button>
        <button
          :disabled="
            locked ||
            selected.state !== 'FETCHED' ||
            selected.review.status !== 'REVIEWING' ||
            !!selected.review.postId
          "
          @click="decide('APPROVED')"
        >
          승인
        </button>
      </div>
      <label
        >초안 제목
        <input v-model="title" maxlength="200" :disabled="locked || !!selected.review.postId"
      /></label>
      <button
        :disabled="
          locked ||
          selected.state !== 'FETCHED' ||
          selected.review.status !== 'APPROVED' ||
          !!selected.review.postId ||
          !title.trim()
        "
        @click="decide('DRAFT')"
      >
        게시글 초안 만들기
      </button>
      <p v-if="selected.review.postId">
        연결된 게시글: {{ selected.review.postId }} ·
        <NuxtLink :to="{ path: '/admin', query: { postId: selected.review.postId } }"
          >게시글 관리에서 열기</NuxtLink
        >
      </p>
      <div class="original-body">
        <template v-for="(block, index) in selected.bodyBlocks" :key="index">
          <p v-if="block.type === 'TEXT'">{{ block.text }}</p>
          <CollectImagePreview
            v-else-if="block.type === 'IMAGE'"
            :src="`/api/v1/admin/collect/batch-items/${selected.itemId}/media/${block.imagePosition}/preview`"
            :alt="block.alt || `수집 이미지 ${block.imagePosition}`"
            :source-url="selected.canonicalUrl"
          />
          <p v-else>
            <a :href="block.url" target="_blank" rel="noopener noreferrer">{{
              block.label || block.url
            }}</a>
          </p>
        </template>
      </div>
      <h3 v-if="selected.attachments.length">첨부 원문 링크</h3>
      <ul>
        <li v-for="attachment in selected.attachments" :key="attachment.position">
          <a :href="attachment.remoteUrl" target="_blank" rel="noopener noreferrer">{{
            attachment.label || attachment.remoteUrl
          }}</a>
        </li>
      </ul>
    </section>
  </main>
</template>
<style scoped>
.batch-admin {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  overflow-wrap: anywhere;
}
.batch-admin form,
.actions,
nav {
  display: flex;
  gap: 12px;
  margin: 20px 0;
  flex-wrap: wrap;
}
.batch-admin form {
  align-items: end;
}
.batch-admin form label {
  display: grid;
  gap: 6px;
  max-width: 100%;
}
.batch-list {
  padding: 0;
  list-style: none;
}
.batch-list li {
  display: grid;
  gap: 6px;
  border-bottom: 1px solid #ddd;
  padding: 12px 0;
}
.batch-list button {
  text-align: left;
  overflow-wrap: anywhere;
}
.batch-list span {
  font-size: 0.85rem;
  color: #666;
}
.batch-detail {
  margin-top: 32px;
  border-top: 2px solid #ddd;
  padding-top: 20px;
}
.batch-detail label {
  display: block;
  margin: 16px 0;
}
.batch-detail input {
  display: block;
  width: 100%;
  max-width: 700px;
}
.original-body {
  margin-top: 24px;
}
.original-body p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.original-body img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 16px 0;
}
button,
input,
select {
  box-sizing: border-box;
  max-width: 100%;
  padding: 8px 12px;
}
button:disabled {
  opacity: 0.5;
}
</style>
