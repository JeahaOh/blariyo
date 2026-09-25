<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
definePageMeta({ path: '/admin/batch' });
type Decision = 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'DRAFT';
type Filters = { source: string; state: string; reviewStatus: string };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFilters(value: unknown): value is Filters {
  return (
    isRecord(value) &&
    typeof value.source === 'string' &&
    typeof value.state === 'string' &&
    typeof value.reviewStatus === 'string'
  );
}
const requestFetch = useRequestFetch();
const route = useRoute();
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
const mobileDetail = ref(false);
const pending = ref<{
  itemId: string;
  path: string;
  body: Record<string, string | number>;
  key: string;
  decision: Decision;
  confirmed: boolean;
} | null>(null);
const locked = computed(() => busy.value || pending.value !== null);
const reauthUrl = computed(
  () =>
    '/admin/login?returnTo=' +
    encodeURIComponent('/admin/batch' + (selected.value ? '?itemId=' + selected.value.itemId : ''))
);
const stateStorageKey = 'blariyo.admin.batch.context.v1';
function rememberContext() {
  try {
    sessionStorage.setItem(
      stateStorageKey,
      JSON.stringify({
        page: page.value,
        filters: appliedFilters.value,
        selectedItemId: selected.value?.itemId || null,
      })
    );
  } catch {
    /* Route query still restores the selected item without session storage. */
  }
}
const collectionLabels: Record<string, string> = {
  DISCOVERED: '수집 대기',
  FETCHING: '수집 중',
  FETCHED: '수집 완료',
  FAILED: '수집 실패',
  BLOCKED: '접근 제한',
  SKIPPED_DUPLICATE: '중복 제외',
  SKIPPED_POLICY: '기간 조건 제외',
};
const sourceLabels: Record<string, string> = {
  theqoo: '더쿠',
  fmkorea: '에펨코리아',
  ppomppu: '뽐뿌',
  ruliweb: '루리웹',
  clien: '클리앙',
  inven: '인벤',
  dcinside: '디시인사이드',
  pgr21: 'PGR21',
};
const flowStep = computed(() => {
  if (!selected.value || selected.value.state !== 'FETCHED') return 1;
  if (selected.value.review.postId) return 4;
  if (selected.value.review.status === 'APPROVED') return 3;
  return 2;
});
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
    mobileDetail.value = true;
    await nextTick();
    document.querySelector<HTMLElement>('.batch-detail h2')?.focus();
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
async function backToList() {
  mobileDetail.value = false;
  await nextTick();
  document
    .querySelector<HTMLElement>(`.batch-list [data-item-id="${selected.value?.itemId}"]`)
    ?.focus();
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(() => !locked.value);
onMounted(async () => {
  let saved: { page?: number; filters?: Filters; selectedItemId?: string } = {};
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(stateStorageKey) || '{}') as unknown;
    if (isRecord(stored)) {
      const value = stored;
      saved = {
        ...(typeof value.page === 'number' ? { page: value.page } : {}),
        ...(typeof value.selectedItemId === 'string'
          ? { selectedItemId: value.selectedItemId }
          : {}),
        ...(isFilters(value.filters) ? { filters: value.filters } : {}),
      };
    }
  } catch {
    /* Ignore stale browser state. */
  }
  const filters =
    saved.filters &&
    typeof saved.filters.source === 'string' &&
    typeof saved.filters.state === 'string' &&
    typeof saved.filters.reviewStatus === 'string'
      ? saved.filters
      : { source: '', state: '', reviewStatus: '' };
  source.value = filters.source;
  state.value = filters.state;
  reviewStatus.value = filters.reviewStatus;
  const requestedPage = Number(saved.page);
  const initialPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  if (initialPage > 1 || Object.values(filters).some(Boolean)) {
    try {
      await fetchList(initialPage, filters);
    } catch {
      listError.value = '이전 검수 목록을 복원하지 못했습니다. 다시 조회해 주세요.';
    }
  }
  const fromRoute = String(route.query.itemId || '');
  const itemId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(fromRoute)
    ? fromRoute
    : saved.selectedItemId || '';
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(itemId)) await open(itemId);
});
</script>
<template>
  <main class="batch-admin">
    <div class="batch-heading">
      <div>
        <h1>수집 결과 검수</h1>
        <p>
          원문을 확인하고 검수한 뒤 초안으로 옮기세요. 발행은 게시글 관리에서 별도로 진행합니다.
        </p>
      </div>
      <span class="batch-count">총 {{ listing?.data.totalItems || 0 }}건</span>
    </div>
    <form class="batch-toolbar" @submit.prevent="refresh(1, true)">
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
      <NuxtLink :to="reauthUrl" target="_blank" rel="noopener">새 탭에서 다시 인증</NuxtLink>
      <button :disabled="busy" @click="executePending">처리 결과 다시 확인</button>
    </div>
    <div v-if="listError" role="alert">
      <p>{{ listError }}</p>
      <button :disabled="locked" @click="refresh()">목록 다시 조회</button>
    </div>
    <div class="batch-split">
      <section class="batch-panel batch-list-panel" aria-label="수집 결과 목록">
        <div class="batch-panel-heading">
          <span>수집 항목</span
          ><small>{{ page }} / {{ listing?.data.totalPages || 1 }} 페이지</small>
        </div>
        <p v-if="!listing?.data.items.length" class="batch-empty">
          조건에 맞는 수집 결과가 없습니다.
        </p>
        <ul class="batch-list">
          <li
            v-for="item in listing?.data.items"
            :key="item.itemId"
            :class="{ 'is-selected': selected?.itemId === item.itemId }"
          >
            <button
              type="button"
              :data-item-id="item.itemId"
              :disabled="locked"
              @click="open(item.itemId)"
            >
              {{ item.title || '제목 없음' }}
            </button>
            <span
              >{{ sourceLabels[item.sourceKey] || item.sourceKey }} ·
              {{ collectionLabels[item.state] || item.state }} · {{ labels[item.review.status]
              }}{{ item.review.postId ? ` · 게시글 ${item.review.postId}` : '' }}</span
            >
          </li>
        </ul>
        <nav class="batch-pagination" aria-label="수집 결과 페이지">
          <button :disabled="locked || page <= 1" @click="refresh(page - 1)">이전</button
          ><span>{{ page }} / {{ listing?.data.totalPages }}</span
          ><button
            :disabled="locked || page >= (listing?.data.totalPages || 1)"
            @click="refresh(page + 1)"
          >
            다음
          </button>
        </nav>
      </section>
      <section
        class="batch-panel batch-detail-panel"
        :class="{
          'is-mobile-hidden': !selected || !mobileDetail,
          'is-mobile-active': selected && mobileDetail,
        }"
        aria-label="수집 결과 상세"
      >
        <button class="batch-mobile-back" type="button" @click="backToList">← 목록으로</button>
        <div v-if="!selected" class="batch-detail-placeholder">
          <span>01 / 항목 선택</span>
          <h2>검수할 수집 항목을 선택하세요</h2>
          <p>선택한 글의 원문과 첨부, 처리 상태를 여기서 확인할 수 있습니다.</p>
        </div>
        <template v-else>
          <div class="batch-panel-heading">
            <span>원문 및 검수</span
            ><small>{{ selected.sourceKey }} · {{ labels[selected.review.status] }}</small>
          </div>
          <div class="batch-detail">
            <h2 tabindex="-1">{{ selected.title || '제목을 가져오지 못한 글' }}</h2>
            <a :href="selected.canonicalUrl" target="_blank" rel="noopener noreferrer"
              >원문 확인 ↗</a
            >
            <p>
              {{ collectionLabels[selected.state] || selected.state }} ·
              {{ labels[selected.review.status] }}
            </p>
            <ol class="batch-workflow" aria-label="원문 검수부터 발행까지">
              <li :class="{ complete: flowStep > 1, current: flowStep === 1 }">원문 확인</li>
              <li :class="{ complete: flowStep > 2, current: flowStep === 2 }">검수</li>
              <li :class="{ complete: flowStep > 3, current: flowStep === 3 }">초안 작성</li>
              <li :class="{ current: flowStep === 4 }">편집·발행</li>
            </ol>
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
                :class="{
                  'batch-action-primary':
                    selected.review.status === 'UNREVIEWED' ||
                    selected.review.status === 'REJECTED',
                }"
                :disabled="locked || selected.state !== 'FETCHED' || !!selected.review.postId"
                @click="decide('REVIEWING')"
              >
                검수 시작 / 다시 검수
              </button>
              <button
                :class="{ 'batch-action-primary': selected.review.status === 'REVIEWING' }"
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
              class="batch-action-primary"
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
              <NuxtLink
                :to="{
                  path: '/admin',
                  query: { postId: selected.review.postId, batchItemId: selected.itemId },
                }"
                @click="rememberContext"
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
          </div>
        </template>
      </section>
    </div>
  </main>
</template>
