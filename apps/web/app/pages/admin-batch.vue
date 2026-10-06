<script setup lang="ts">
import { draftTitle } from '@blariyo/contracts/draft-title';
import { apiError, type ApiResponse } from '~~/shared/api-types';
definePageMeta({ path: '/admin/batch' });
type Decision = 'APPROVED' | 'REJECTED' | 'DRAFT' | 'PUBLISH';
type Filters = { source: string; state: string; reviewStatus: string };
type BatchRow = ApiResponse<'listBatchItems'>['data']['items'][number];
type BulkEntry = {
  item: BatchRow;
  key: string;
  body?: { itemVersion: number; lockVersion: number; contentDigest?: string; decision?: 'REJECTED' };
  status: 'waiting' | 'success' | 'failed' | 'unknown';
  reason?: string;
};
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
const { data: features } = await useAsyncData('admin-features', () =>
  requestFetch<{ batchReview: boolean; directInput: boolean }>('/api/admin/features').catch(
    () => null
  )
);
if (!features.value?.batchReview && !features.value?.directInput)
  throw createError({ statusCode: 404, message: '수집 기능을 사용할 수 없습니다.' });
const { data: listing, error } = await useAsyncData('batch-review-list', () =>
  features.value?.batchReview
    ? requestFetch<ApiResponse<'listBatchItems'>>('/api/v1/admin/collect/batch-items')
    : Promise.resolve(null)
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
const listRequests = ref(0);
const listLoading = computed(() => listRequests.value > 0);
const appliedFilters = ref<Filters>({ source: '', state: '', reviewStatus: '' });
const selected = ref<ApiResponse<'getBatchItem'>['data']['item'] | null>(null);
const restoringContext = ref(true);
const expiredPostId = ref<number | null>(null);
const helpOpen = ref(false);
const checkedIds = ref<string[]>([]);
const bulkEntries = ref<BulkEntry[]>([]);
const bulkRunning = ref(false);
const bulkAction = ref<'REJECTED' | 'DELETE'>('REJECTED');
const bulkVerb = computed(() => bulkAction.value === 'DELETE' ? '삭제' : '반려');
const deleteConfirmOpen = ref(false);
const deleteCandidates = ref<BatchRow[]>([]);
function rejectable(item: BatchRow) {
  return item.state === 'FETCHED' && item.review.status !== 'REJECTED' &&
    !item.review.postId && Date.parse(item.retention.expiresAt) > Date.now();
}
function deletable(item: BatchRow) {
  return ['FAILED', 'BLOCKED'].includes(item.state) && item.review.status === 'UNREVIEWED' &&
    !item.review.postId && Date.parse(item.retention.expiresAt) > Date.now();
}
const selectableItems = computed(() => (listing.value?.data.items ?? []).filter(item => rejectable(item) || deletable(item)));
const checkedItems = computed(() => selectableItems.value.filter(item => checkedIds.value.includes(item.itemId)));
const checkedRejectable = computed(() => checkedItems.value.filter(rejectable));
const checkedDeletable = computed(() => checkedItems.value.filter(deletable));
const allChecked = computed(() => selectableItems.value.length > 0 && checkedItems.value.length === selectableItems.value.length);
const bulkUnknown = computed(() => bulkEntries.value.filter(entry => entry.status === 'unknown'));
const bulkSuccessCount = computed(() => bulkEntries.value.filter(entry => entry.status === 'success').length);
const bulkFailures = computed(() => bulkEntries.value.filter(entry => entry.status === 'failed'));
function toggleAll() {
  if (!locked.value) checkedIds.value = allChecked.value ? [] : selectableItems.value.map(item => item.itemId);
}
const linkedPost = ref<ApiResponse<'getPostEditor'>['data'] | null>(null);
const resettingSelection = ref(false);
function expireOriginal() {
  const expiredItemId = selected.value?.itemId;
  expiredPostId.value = selected.value?.review.postId ?? null;
  selected.value = null;
  title.value = '';
  pending.value = null;
  if (listing.value) {
    const before = listing.value.data.items.length;
    listing.value.data.items = listing.value.data.items.filter(
      (item) => item.itemId !== expiredItemId && Date.parse(item.retention.expiresAt) > Date.now()
    );
    listing.value.data.totalItems = Math.max(
      0,
      listing.value.data.totalItems - before + listing.value.data.items.length
    );
    listing.value.data.totalPages = Math.max(1, Math.ceil(listing.value.data.totalItems / 20));
  }
  message.value = '원문 보관 기한이 지나 본문과 미리보기를 닫았습니다.';
  void fetchList(page.value, appliedFilters.value, true).catch(() => {
    listError.value = '만료 원문을 닫았습니다. 목록을 다시 조회해 주세요.';
  });
}
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => selected.value?.retention.expiresAt,
  (deadline) => {
    clearTimeout(expiryTimer);
    if (!deadline || !import.meta.client) return;
    const expire = () => {
      const remaining = Date.parse(deadline) - Date.now();
      if (remaining > 0) {
        expiryTimer = setTimeout(expire, Math.min(2147483647, remaining));
        return;
      }
      expireOriginal();
    };
    expire();
  }
);
onUnmounted(() => clearTimeout(expiryTimer));
const pending = ref<{
  itemId: string;
  path: string;
  body: Record<string, string | number>;
  key: string;
  decision: Decision;
  confirmed: boolean;
  title: string;
} | null>(null);
const locked = computed(() => busy.value || listLoading.value || pending.value !== null || bulkUnknown.value.length > 0 || deleteConfirmOpen.value);
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
const { codes: sourceCodes, sourceName, error: sourceCodesError } = await useSourceCodes();
const sourceOptions = computed(() => {
  const options = new Map(sourceCodes.value.map((item) => [item.sourceKey, item.displayName]));
  for (const key of [source.value, selected.value?.sourceKey, ...(listing.value?.data.items.map((item) => item.sourceKey) ?? [])]) {
    if (key && !options.has(key)) options.set(key, key);
  }
  return [...options].map(([key, name]) => ({ key, name })).sort((a,b) => a.name.localeCompare(b.name, 'ko'));
});
const flowStep = computed(() => {
  if (!selected.value || selected.value.state !== 'FETCHED') return 1;
  if (linkedPost.value?.status === 'PUBLISHED') return 4;
  if (selected.value.review.postId) return 3;
  if (selected.value.review.status === 'APPROVED') return 3;
  return 2;
});
const labels: Record<string, string> = {
  UNREVIEWED: '검수 전',
  APPROVED: '승인',
  REJECTED: '반려',
};
async function fetchList(n: number, filters: Filters, background = false) {
  checkedIds.value = [];
  if (!background) listRequests.value++;
  try {
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
    rememberContext();
  } finally {
    if (!background) listRequests.value--;
  }
}
async function refresh(n = page.value, apply = false) {
  if (locked.value) return;
  checkedIds.value = [];
  bulkEntries.value = [];
  busy.value = true;
  try {
    resettingSelection.value = true;
    selected.value = null;
    linkedPost.value = null;
    title.value = '';
    message.value = '';
    expiredPostId.value = null;
    const query = { ...route.query };
    delete query.itemId;
    await navigateTo({ path: '/admin/batch', query }, { replace: true });
    resettingSelection.value = false;
    await fetchList(
      n,
      apply
        ? { source: source.value.trim(), state: state.value, reviewStatus: reviewStatus.value }
        : appliedFilters.value
    );
  } catch {
    listError.value = '목록을 불러오지 못했습니다. 현재 목록을 유지합니다. 다시 조회해 주세요.';
  } finally {
    resettingSelection.value = false;
    busy.value = false;
  }
}
async function open(id: string) {
  if (locked.value) return;
  if (route.query.itemId !== id) {
    await navigateTo({ path: '/admin/batch', query: { ...route.query, itemId: id } });
    return;
  }
  await readItem(id);
}
async function readItem(id: string) {
  busy.value = true;
  linkedPost.value = null;
  selected.value = null;
  title.value = '';
  message.value = '';
  expiredPostId.value = null;
  try {
    selected.value = (
      await $fetch<ApiResponse<'getBatchItem'>>(`/api/v1/admin/collect/batch-items/${id}`, {
        retry: 0,
      })
    ).data.item;
    title.value = draftTitle(selected.value.title || '', selected.value.sourceKey);
    if (selected.value.review.postId) {
      try { linkedPost.value = (await $fetch<ApiResponse<'getPostEditor'>>(`/api/v1/admin/posts/${selected.value.review.postId}`, { retry: 0 })).data; }
      catch { message.value = '연결된 게시글 상태를 확인하지 못했습니다. 상세를 다시 열어 주세요.'; }
    }
    await nextTick();
    document.querySelector<HTMLElement>('.batch-detail h2')?.focus();
  } catch (error) {
    selected.value = null;
    title.value = '';
    message.value =
      apiError(error).code === 'BATCH_ITEM_EXPIRED'
        ? '원문 보관 기한이 지나 본문과 미리보기를 닫았습니다.'
        : '상세를 불러오지 못했습니다. 수집 결과와 본문 형식을 확인해 주세요.';
  } finally {
    busy.value = false;
  }
}
async function decide(decision: 'APPROVED' | 'REJECTED' | 'PUBLISH') {
  const item = selected.value;
  if (!item || locked.value || (decision === 'APPROVED' && !title.value.trim()) || (decision === 'PUBLISH' && linkedPost.value?.status !== 'DRAFT')) return;
  pending.value = {
    itemId: item.itemId,
    path: decision === 'PUBLISH' ? `/api/v1/admin/posts/${item.review.postId}/publish` : `/api/v1/admin/collect/batch-items/${item.itemId}/review`,
    body: decision === 'PUBLISH' ? { lockVersion: linkedPost.value!.lockVersion, mode: 'IMMEDIATE' } : {
      itemVersion: item.version,
      lockVersion: item.review.lockVersion,
      decision, contentDigest: item.contentDigest,
    },
    key: crypto.randomUUID(),
    decision,
    confirmed: false,
    title: title.value,
  };
  await executePending();
}
async function rejectChecked() {
  if (locked.value || !checkedRejectable.value.length) return;
  bulkAction.value = 'REJECTED';
  bulkEntries.value = checkedRejectable.value.map(item => ({ item, key: crypto.randomUUID(), status: 'waiting' }));
  await executeBulk();
}
function requestDeletion(items: BatchRow[]) {
  if (locked.value) return;
  deleteCandidates.value = items.filter(deletable);
  if (deleteCandidates.value.length) deleteConfirmOpen.value = true;
}
async function confirmDeletion() {
  if (!deleteConfirmOpen.value || busy.value) return;
  bulkAction.value = 'DELETE';
  bulkEntries.value = deleteCandidates.value.map(item => ({ item, key: crypto.randomUUID(), status: 'waiting',
    body: { itemVersion: item.version, lockVersion: item.review.lockVersion } }));
  deleteConfirmOpen.value = false;
  await executeBulk();
}
async function executeBulk() {
  if (busy.value || listLoading.value || pending.value) return;
  busy.value = true;
  bulkRunning.value = true;
  message.value = '';
  checkedIds.value = [];
  try {
    // Close stale details before changing review states, including the URL selection.
    resettingSelection.value = true;
    selected.value = null;
    linkedPost.value = null;
    title.value = '';
    const query = { ...route.query };
    delete query.itemId;
    await navigateTo({ path: '/admin/batch', query }, { replace: true });
    resettingSelection.value = false;
    for (const entry of bulkEntries.value) {
      if (entry.status !== 'waiting' && entry.status !== 'unknown') continue;
      let submitted = false;
      try {
        if (!entry.body) {
          const item = (await $fetch<ApiResponse<'getBatchItem'>>(`/api/v1/admin/collect/batch-items/${entry.item.itemId}`, { retry: 0 })).data.item;
          if (!rejectable(item) || item.version !== entry.item.version ||
              item.review.lockVersion !== entry.item.review.lockVersion || item.review.status !== entry.item.review.status) {
            entry.status = 'failed';
            entry.reason = '수집 내용 또는 검수 상태가 바뀌었습니다. 다시 조회해 주세요.';
            continue;
          }
          entry.body = { itemVersion: item.version, lockVersion: item.review.lockVersion, contentDigest: item.contentDigest, decision: 'REJECTED' };
        }
        submitted = true;
        await $fetch<ApiResponse<'reviewBatchItem'> | ApiResponse<'deleteBatchItem'>>(`/api/v1/admin/collect/batch-items/${entry.item.itemId}/${bulkAction.value === 'DELETE' ? 'delete' : 'review'}`, {
          method: 'POST', body: entry.body, headers: { 'Idempotency-Key': entry.key }, retry: 0,
        });
        entry.status = 'success';
        delete entry.reason;
      } catch (error) {
        const code = apiError(error).code ?? '';
        const definite = ['BATCH_ITEM_EXPIRED', 'BATCH_ITEM_NOT_FOUND', 'BATCH_ALREADY_PROMOTED',
          'BATCH_ITEM_STATE_CONFLICT', 'BATCH_ITEM_VERSION_CONFLICT', 'BATCH_REVIEW_STATE_CONFLICT',
          'BATCH_REVIEW_VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'VALIDATION_FAILED', 'BATCH_ITEM_BUSY', 'BATCH_CONTENT_INVALID'].includes(code);
        entry.status = submitted && !definite ? 'unknown' : 'failed';
        entry.reason = entry.status === 'unknown' ? `${bulkVerb.value} 결과를 확인하지 못했습니다.`
          : code === 'BATCH_ITEM_BUSY' ? '수집이 진행 중입니다. 배치가 끝난 뒤 다시 시도해 주세요.'
          : code === 'BATCH_ITEM_EXPIRED' ? '원문 보관 기한이 지났습니다.'
          : code.includes('CONFLICT') || code === 'BATCH_ALREADY_PROMOTED' ? '수집 내용 또는 검수 상태가 바뀌었습니다. 다시 조회해 주세요.'
          : '처리하지 못했습니다. 연결 상태와 최신 항목을 확인해 주세요.';
      }
    }
    try { await fetchList(page.value, appliedFilters.value); }
    catch { listError.value = `목록을 갱신하지 못해 이전 목록을 표시합니다. 항목별 ${bulkVerb.value} 결과를 확인해 주세요.`; }
  } finally {
    resettingSelection.value = false;
    bulkRunning.value = false;
    busy.value = false;
  }
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
    let post: ApiResponse<'promoteBatchItem'>['data'] | null = null;
    if (request.decision === 'DRAFT') {
      post = (await $fetch<ApiResponse<'promoteBatchItem'>>(request.path, options)).data;
    } else if (request.decision === 'PUBLISH') {
      await $fetch<ApiResponse<'publishPost'>>(request.path, options);
    } else await $fetch<ApiResponse<'reviewBatchItem'>>(request.path, options);
    request.confirmed = true;
    selected.value = (
      await $fetch<ApiResponse<'getBatchItem'>>(
        `/api/v1/admin/collect/batch-items/${request.itemId}`, { retry: 0 }
      )
    ).data.item;
    if (request.decision === 'APPROVED' || request.decision === 'DRAFT') {
      pending.value = {
        itemId: request.itemId,
        path: post ? `/api/v1/admin/posts/${post.postId}/publish` : `/api/v1/admin/collect/batch-items/${request.itemId}/draft`,
        body: post ? { lockVersion: post.lockVersion, mode: 'IMMEDIATE' } : {
          itemVersion: selected.value.version, lockVersion: selected.value.review.lockVersion,
          boardSlug: 'meme', title: request.title,
        },
        key: crypto.randomUUID(), decision: post ? 'PUBLISH' : 'DRAFT',
        confirmed: false, title: request.title,
      };
      busy.value = false;
      await executePending();
      return;
    }
    if (request.decision === 'PUBLISH' && selected.value.review.postId) {
      linkedPost.value = (await $fetch<ApiResponse<'getPostEditor'>>(`/api/v1/admin/posts/${selected.value.review.postId}`, { retry: 0 })).data;
    }
    pending.value = null;
    message.value = request.decision === 'PUBLISH'
      ? `게시글 ${selected.value.review.postId}번을 발행했습니다.` : '검수 상태를 저장했습니다.';
    // The command and detail are confirmed. A list failure must not turn this into an uncertain save.
    try {
      await fetchList(page.value, appliedFilters.value);
    } catch {
      listError.value =
        '저장은 완료했지만 목록을 새로 불러오지 못했습니다. 목록을 다시 조회해 주세요.';
    }
  } catch (error) {
    const code = apiError(error).code;
    if (code === 'BATCH_ITEM_EXPIRED') {
      expireOriginal();
      return;
    }
    const definitive =
      code &&
      [
        'POST_VERSION_CONFLICT',
        'POST_STATE_CONFLICT',
        'POST_NOT_FOUND',
        'IMAGE_STATE_CONFLICT',
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
          : request.decision === 'PUBLISH'
            ? '초안은 생성됐지만 발행하지 못했습니다. 게시글 관리에서 최신 상태를 확인해 주세요.'
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
async function syncSelection() {
  const id = route.query.itemId;
  if (features.value?.batchReview && typeof id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    await readItem(id);
    return;
  }
  const previousId = selected.value?.itemId;
  selected.value = null;
  linkedPost.value = null;
  title.value = '';
  expiredPostId.value = null;
  message.value = id ? '올바른 수집 항목 주소가 아닙니다.' : '';
  await nextTick();
  const previous = previousId && document.querySelector<HTMLElement>(`.batch-list [data-item-id="${previousId}"]`);
  (previous || document.querySelector<HTMLElement>('.batch-list-panel'))?.focus();
}
watch(() => route.query.itemId, () => {
  if (!restoringContext.value && !resettingSelection.value) void syncSelection();
});
onBeforeRouteUpdate((to, from) => {
  if (to.query.itemId !== from.query.itemId && locked.value && !resettingSelection.value) return false;
});
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(() => !locked.value);
onMounted(async () => {
  if (!features.value?.batchReview) return;
  let saved: { page?: number; filters?: Filters } = {};
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(stateStorageKey) || '{}') as unknown;
    if (isRecord(stored)) {
      const value = stored;
      saved = {
        ...(typeof value.page === 'number' ? { page: value.page } : {}),
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
  if (filters.reviewStatus === 'REVIEWING') filters.reviewStatus = 'UNREVIEWED';
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
  restoringContext.value = false;
  await syncSelection();
});
useUiLoading(() => busy.value || listLoading.value);
</script>
<template>
  <main class="batch-admin">
    <div class="batch-heading">
        <h1>수집 결과 검수</h1>
        <button class="batch-help" type="button" aria-label="사용 안내" title="사용 안내" @click="helpOpen = true">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 2-2.5 3.7M12 16h.01" />
          </svg>
        </button>
    </div>
    <AppDialog v-model="helpOpen" title="검수 안내">
      <p><strong>승인 및 발행</strong> — 확인한 글을 바로 공개합니다.</p>
      <p><strong>반려</strong> — 게시하지 않을 글로 표시합니다.</p>
    </AppDialog>
    <AppDialog v-model="deleteConfirmOpen" title="수집 실패 항목 삭제">
      <p>실패·차단 항목 {{ deleteCandidates.length }}건을 삭제하시겠습니까?</p>
      <p>삭제하면 되돌릴 수 없으며 자동 재수집 대상에서도 제외됩니다.</p>
      <template #actions><div class="dialog-confirm-actions">
        <button autofocus @click="deleteConfirmOpen = false">취소</button>
        <button @click="confirmDeletion">삭제</button>
      </div></template>
    </AppDialog>
    <NuxtLink v-if="expiredPostId" :to="{ path: '/admin', query: { postId: expiredPostId } }"
      >보존된 게시글 사본 열기</NuxtLink
    >
    <DirectCollectionInput
      v-if="features?.directInput"
      :review-enabled="features.batchReview"
      @collected="open"
    />
    <template v-if="features?.batchReview">
      <form class="batch-toolbar" @submit.prevent="refresh(1, true)">
        <label><span id="batch-source-label">출처</span><select aria-labelledby="batch-source-label" v-model="source" :disabled="locked">
          <option value="">전체 출처</option>
          <option v-for="item in sourceOptions" :key="item.key" :value="item.key">{{ item.name }}</option>
        </select></label>
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
        <button :disabled="locked">{{ listLoading ? '조회 중…' : '조회' }}</button>
      </form>
      <p v-if="sourceCodesError" role="alert">출처명을 불러오지 못했습니다. 현재 결과의 코드로 표시합니다. 화면을 새로고침해 주세요.</p>
      <p role="status">{{ message }}</p>
      <div v-if="bulkEntries.length" class="batch-bulk-result">
        <p role="status">{{ bulkRunning ? `${bulkVerb} 처리 중…` : `${bulkVerb} 결과` }} · 완료 {{ bulkSuccessCount }}건 · 실패 {{ bulkFailures.length }}건 · 결과 미확인 {{ bulkUnknown.length }}건</p>
        <ul v-if="bulkFailures.length || bulkUnknown.length">
          <li v-for="entry in [...bulkFailures, ...bulkUnknown]" :key="entry.item.itemId">
            {{ draftTitle(entry.item.title || '', entry.item.sourceKey) || '제목 없음' }}: {{ entry.reason }}
          </li>
        </ul>
        <div v-if="bulkUnknown.length" class="batch-bulk-recovery">
          <NuxtLink :to="reauthUrl" target="_blank" rel="noopener">새 탭에서 다시 인증</NuxtLink>
          <button :disabled="busy" @click="executeBulk">{{ bulkVerb }} 결과 다시 확인</button>
        </div>
      </div>
      <div v-if="pending" role="alert">
        <p>처리 결과 확인이 끝날 때까지 이 화면을 유지해 주세요.</p>
        <NuxtLink :to="reauthUrl" target="_blank" rel="noopener">새 탭에서 다시 인증</NuxtLink>
        <button :disabled="busy" @click="executePending">처리 결과 다시 확인</button>
      </div>
      <div v-if="listError" role="alert">
        <p>{{ listError }}</p>
        <button :disabled="locked" @click="refresh()">{{ listLoading ? '목록 다시 조회 중…' : '목록 다시 조회' }}</button>
      </div>
      <div class="batch-split" :class="{ 'has-detail': !!selected }">
        <section class="batch-panel batch-list-panel" aria-label="수집 결과 목록" :aria-busy="listLoading || bulkRunning" tabindex="-1">
          <div v-if="listing?.data.items.length" class="batch-panel-heading">
            <span>조회 결과 <small>{{ listing.data.totalItems }}건</small></span>
          </div>
          <div v-if="listing?.data.items.length" class="batch-selection-toolbar">
            <label class="batch-check-all">
              <input type="checkbox" :checked="allChecked" :indeterminate="checkedItems.length > 0 && !allChecked"
                :disabled="locked || !selectableItems.length" @change="toggleAll" />
              이 페이지 전체 선택
            </label>
            <div class="batch-selection-actions">
              <span class="batch-selected-count">{{ checkedItems.length }}건 선택</span>
              <button :disabled="locked || !checkedRejectable.length" :title="`수집 완료 ${checkedRejectable.length}건 반려`" @click="rejectChecked">선택 반려</button>
              <button :disabled="locked || !checkedDeletable.length" :title="`실패·차단 ${checkedDeletable.length}건 삭제`" @click="requestDeletion(checkedDeletable)">선택 삭제</button>
            </div>
          </div>
          <p v-if="!listing?.data.items.length" class="batch-empty">
            조건에 맞는 수집 결과가 없습니다.
          </p>
          <ul v-else class="batch-list">
            <li
              v-for="item in listing?.data.items"
              :key="item.itemId"
              :class="{ 'is-selected': selected?.itemId === item.itemId }"
            >
              <input v-model="checkedIds" type="checkbox" :value="item.itemId"
                :aria-label="`${draftTitle(item.title || '', item.sourceKey) || '제목 없음'} 선택`"
                :disabled="locked || (!rejectable(item) && !deletable(item))" />
              <button
                type="button"
                :data-item-id="item.itemId"
                :disabled="locked"
                @click="open(item.itemId)"
              >
                {{ draftTitle(item.title || '', item.sourceKey) || '제목 없음' }}
              </button>
              <span
                >{{ sourceName(item.sourceKey) }} ·
                {{ collectionLabels[item.state] || item.state }} · {{ labels[item.review.status]
                }}{{ item.review.postId ? ` · 게시글 ${item.review.postId}` : '' }}</span
              >
            </li>
          </ul>
          <nav v-if="listing?.data.items.length && listing.data.totalPages > 1" class="batch-pagination" aria-label="수집 결과 페이지">
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
          v-if="selected"
          class="batch-panel batch-detail-panel"
          :class="{ 'is-mobile-active': !!selected }"
          aria-label="수집 결과 상세"
        >
          <template v-if="selected">
            <div class="batch-panel-heading">
              <span>원문 및 검수</span
              ><small>{{ sourceName(selected.sourceKey) }} · {{ labels[selected.review.status] }}</small>
            </div>
            <div class="batch-detail">
              <h2 tabindex="-1">{{ draftTitle(selected.title || '', selected.sourceKey) || '제목을 가져오지 못한 글' }}</h2>
              <p>
                {{ collectionLabels[selected.state] || selected.state }} ·
                {{ labels[selected.review.status] }}
              </p>
              <ol class="batch-workflow" aria-label="원문 검수부터 발행까지">
                <li :class="{ complete: flowStep > 1, current: flowStep === 1 }">원문 확인</li>
                <li :class="{ complete: flowStep > 2, current: flowStep === 2 }">검수</li>
                <li :class="{ complete: flowStep > 3, current: flowStep === 3 }">초안 작성</li>
                <li :class="{ current: flowStep === 4 }">발행 완료</li>
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
              <label
                >초안 제목
                <input
                  v-model="title"
                  maxlength="200"
                  :disabled="locked || !!selected.review.postId"
              /></label>
              <div class="batch-detail-actions" role="group" aria-label="수집 항목 처리">
                <div class="actions">
                  <a class="batch-original-link" :href="selected.canonicalUrl" target="_blank" rel="noopener noreferrer" title="원본 게시글을 새 탭에서 열기">원본 열기 ↗</a>
                  <button v-if="deletable(selected)" :disabled="locked" @click="requestDeletion([selected])">삭제</button>
                  <button
                    :disabled="locked || selected.state !== 'FETCHED' || !!selected.review.postId"
                    @click="decide('REJECTED')"
                  >
                    반려
                  </button>
                  <button
                    :disabled="locked || selected.state !== 'FETCHED' || !!selected.review.postId || !title.trim()"
                    :class="{ 'batch-action-primary': selected.review.status !== 'APPROVED' }"
                    @click="decide('APPROVED')"
                  >
                    승인 및 발행
                  </button>
                  <button v-if="linkedPost?.status === 'DRAFT'" class="batch-action-primary" :disabled="locked" @click="decide('PUBLISH')">발행 재시도</button>
                </div>
              </div>
              <p v-if="linkedPost">게시글 상태: {{ linkedPost.status === 'PUBLISHED' ? '발행 완료' : linkedPost.status === 'DRAFT' ? '초안' : linkedPost.status === 'SCHEDULED' ? '예약' : '비공개' }}</p>
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
                    :status-path="`/api/v1/admin/collect/batch-items/${selected.itemId}`"
                    @expired="expireOriginal"
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
    </template>
  </main>
</template>
