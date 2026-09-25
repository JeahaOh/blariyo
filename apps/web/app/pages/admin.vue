<script setup lang="ts">
import { apiError, type ApiResponse, type EditorState } from '~~/shared/api-types';
import type { components } from '@blariyo/contracts/api';
import { uploadError } from '../utils/upload-errors.mjs';
import { editorErrors } from '../utils/editor-validation.mjs';
const route = useRoute();
const uploadErrors = ref<ReturnType<typeof uploadError>['details']>([]);
const validation = ref<Record<string, string>>({});
const requestFetch = useRequestFetch();
const batchItemId = computed(() => {
  const value = String(route.query.batchItemId || '');
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : '';
});
const { data: search, error } = await useAsyncData('admin-search', () =>
  requestFetch<ApiResponse<'searchAdminPosts'>>('/api/v1/admin/posts')
);
const labels: Record<string, string> = {
  DRAFT: '초안',
  SCHEDULED: '예약됨',
  PUBLISHED: '공개 중',
  HIDDEN_REVIEW: '숨김 검토',
  REMOVED: '삭제됨',
};
const searchBusy = ref(false),
  searchError = ref(error.value ? '목록을 불러오지 못했습니다. 다시 시도해 주세요.' : ''),
  mobileEditor = ref(false),
  detailRetry = ref<number | string | null>(null),
  conflict = ref(false);
const imageFailures = ref<Record<number, boolean>>({});
const searchRetryPage = ref(1);
const imageAttempts = ref<Record<number, number>>({});
const taskLabel = ref('');
const recovery = ref<{
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: Record<string, unknown>;
} | null>(null);
const locked = computed(() => busy.value || !!recovery.value);
function stateLabel(value?: string) {
  return labels[value || ''] || '새 초안';
}
function kst(value: string) {
  return (
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value)) + ' KST'
  );
}
function boardName(slug: string) {
  return boards.value?.data.items.find((b) => b.slug === slug)?.displayName || slug;
}
function failureMessage(e: unknown, fallback: string) {
  const code = apiError(e).code || '';
  const statusCode = typeof e === 'object' && e !== null && 'statusCode' in e ? e.statusCode : 0;
  return statusCode === 401 || statusCode === 403 || /UNAUTHORIZED|FORBIDDEN|AUTH/.test(code)
    ? '관리자 인증 또는 접근 권한을 확인해 주세요. 입력한 내용은 유지됩니다.'
    : fallback;
}
async function focusEditor() {
  mobileEditor.value = true;
  await nextTick();
  document.querySelector<HTMLElement>('#editor-heading')?.focus();
}
async function backToList() {
  if (locked.value) return;
  mobileEditor.value = false;
  await nextTick();
  // A status change can remove the selected post from the current search results.
  const target = document.querySelector<HTMLElement>(`[data-post-id="${editor.value.postId}"]`);
  (target || document.querySelector<HTMLElement>('#new-draft'))?.focus();
}
const status = ref(''),
  titlePrefix = ref(''),
  board = ref(''),
  from = ref(''),
  to = ref(''),
  page = ref(1),
  busy = ref(false),
  message = ref(''),
  saved = ref(''),
  scheduled = ref(''),
  pending = ref<{ signature: string; key: string; confirmed: boolean } | null>(null);
const republishPin = ref<components['schemas']['PinnedPosition']>(null),
  hideReason = ref('RIGHTS_EMAIL');
function scheduleSlot(hour: number, minute: number) {
  const kst = new Date(Date.now() + 9 * 3600000);
  let time = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), hour - 9, minute)
  );
  if (+time < Date.now() + 60000) time = new Date(+time + 86400000);
  scheduled.value = new Date(+time + 9 * 3600000).toISOString().slice(0, 16);
}
const fresh = (): EditorState => ({
  boardSlug: 'meme',
  title: '',
  source: null,
  pinnedPosition: null,
  blocks: [{ type: 'TEXT', text: '' }],
});
const editor = ref(fresh()),
  sourceName = ref(''),
  sourceUrl = ref('');
const dirty = computed(
  () =>
    JSON.stringify({
      ...editor.value,
      sourceName: sourceName.value,
      sourceUrl: sourceUrl.value,
    }) !== saved.value
);
const editable = computed(
  () =>
    !editor.value.status || ['DRAFT', 'SCHEDULED', 'HIDDEN_REVIEW'].includes(editor.value.status)
);
const waiting = computed(() =>
  editor.value.blocks.some((b) => 'status' in b && b.status === 'PUBLIC_DELETE_PENDING')
);
const { data: boards } = await useFetch<ApiResponse<'listBoards'>>('/api/v1/boards');
function remember() {
  saved.value = JSON.stringify({
    ...editor.value,
    sourceName: sourceName.value,
    sourceUrl: sourceUrl.value,
  });
}
remember();
async function load(id: number | string) {
  if (locked.value) return;
  if (dirty.value && !confirm('저장하지 않은 변경을 버리고 이동할까요?')) return;
  busy.value = true;
  taskLabel.value = '게시글을 불러오는 중…';
  detailRetry.value = id;
  try {
    const result = await $fetch<ApiResponse<'getPostEditor'>>(`/api/v1/admin/posts/${id}`);
    editor.value = result.data;
    sourceName.value = result.data.source?.name || '';
    sourceUrl.value = result.data.source?.url || '';
    pending.value = null;
    validation.value = {};
    uploadErrors.value = [];
    message.value = '';
    conflict.value = false;
    detailRetry.value = null;
    imageFailures.value = {};
    remember();
    await focusEditor();
  } catch (e) {
    message.value = failureMessage(e, '게시글을 불러오지 못했습니다. 입력한 내용은 유지됩니다.');
  } finally {
    busy.value = false;
  }
}
function newDraft() {
  if (locked.value) return;
  if (dirty.value && !confirm('저장하지 않은 변경을 버리고 새 초안을 만들까요?')) return;
  conflict.value = false;
  detailRetry.value = null;
  imageFailures.value = {};
  scheduled.value = '';
  editor.value = fresh();
  sourceName.value = '';
  sourceUrl.value = '';
  pending.value = null;
  validation.value = {};
  uploadErrors.value = [];
  message.value = '';
  remember();
  void focusEditor();
}
async function searchPosts(n = 1) {
  if (searchBusy.value) return;
  searchBusy.value = true;
  searchRetryPage.value = n;
  searchError.value = '';
  try {
    if (from.value && to.value && from.value > to.value) throw new Error('DATE_RANGE');
    const result = await $fetch<ApiResponse<'searchAdminPosts'>>('/api/v1/admin/posts', {
      query: {
        ...(status.value ? { status: status.value } : {}),
        ...(board.value ? { board: board.value } : {}),
        ...(titlePrefix.value.trim() ? { titlePrefix: titlePrefix.value.trim() } : {}),
        ...(from.value ? { from: new Date(from.value + '+09:00').toISOString() } : {}),
        ...(to.value ? { to: new Date(to.value + '+09:00').toISOString() } : {}),
        page: n,
      },
      retry: 0,
    });
    search.value = result;
    page.value = n;
  } catch (e) {
    searchError.value = failureMessage(
      e,
      '목록을 불러오지 못했습니다. 검색 조건과 수정일 범위를 확인하고 다시 시도해 주세요.'
    );
  } finally {
    searchBusy.value = false;
  }
}
function editableBlocks(): components['schemas']['EditBlocks'] {
  return editor.value.blocks.map((b) =>
    b.type === 'TEXT'
      ? { type: 'TEXT', text: b.text }
      : { type: 'IMAGE', imageId: b.imageId, alt: b.alt }
  );
}
async function execute(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: Record<string, unknown>
) {
  if (busy.value) return;
  const signature = JSON.stringify({ path, method, body });
  if (!pending.value || pending.value.signature !== signature)
    pending.value = { signature, key: crypto.randomUUID(), confirmed: false };
  busy.value = true;
  taskLabel.value = '저장 결과를 확인하는 중…';
  message.value = '';
  // A rejection of this retry does not establish the outcome of the earlier submission.
  // Keep its body/key locked until an idempotent replay and detail read both succeed.
  const recovering = recovery.value !== null;
  recovery.value = { path, method, body };
  let confirmed = pending.value.confirmed;
  try {
    const result = await $fetch<
      ApiResponse<
        | 'createPost'
        | 'updatePost'
        | 'publishPost'
        | 'hidePost'
        | 'removePost'
        | 'republishPost'
        | 'unschedulePost'
      >
    >(path, {
      method,
      body,
      headers: { 'Idempotency-Key': pending.value.key },
      retry: 0,
    });
    confirmed = true;
    pending.value.confirmed = true;
    const resultDetail = await $fetch<ApiResponse<'getPostEditor'>>(
      `/api/v1/admin/posts/${result.data.postId}`
    );
    pending.value = null;
    recovery.value = null;
    conflict.value = false;
    editor.value = resultDetail.data;
    sourceName.value = editor.value.source?.name || '';
    sourceUrl.value = editor.value.source?.url || '';
    remember();
    await searchPosts(page.value);
    message.value = '저장했습니다.';
  } catch (e) {
    const code = apiError(e).code;
    const statusCode = typeof e === 'object' && e !== null && 'statusCode' in e ? e.statusCode : 0;
    const authenticationFailure =
      statusCode === 401 || statusCode === 403 || /UNAUTHORIZED|FORBIDDEN|AUTH/.test(code || '');
    conflict.value = code === 'POST_VERSION_CONFLICT';
    if (
      !confirmed &&
      !(recovering && authenticationFailure) &&
      code &&
      ![
        'DEPENDENCY_UNAVAILABLE',
        'TEMPORARILY_UNAVAILABLE',
        'INTERNAL_ERROR',
        'IDEMPOTENCY_IN_PROGRESS',
      ].includes(code)
    ) {
      recovery.value = null;
      pending.value = null;
    }
    message.value =
      code === 'POST_VERSION_CONFLICT'
        ? '다른 변경이 반영되었습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.'
        : failureMessage(
            e,
            recovery.value
              ? '처리하지 못했습니다. 저장 결과가 불확실합니다. 입력은 보존되어 있으며 같은 요청으로 다시 확인해 주세요.'
              : '처리하지 못했습니다. 입력과 게시글 상태를 확인한 뒤 다시 시도해 주세요.'
          );
  } finally {
    busy.value = false;
  }
}
async function save() {
  if (locked.value) return;
  validation.value = editorErrors(editor.value, sourceName.value, sourceUrl.value);
  if (Object.keys(validation.value).length) {
    message.value = '입력한 내용을 확인해 주세요.';
    await nextTick();
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return;
  }
  const source =
    sourceName.value || sourceUrl.value ? { name: sourceName.value, url: sourceUrl.value } : null;
  const body = {
    title: editor.value.title,
    source,
    blocks: editableBlocks(),
    ...(editor.value.status === 'HIDDEN_REVIEW'
      ? {}
      : { pinnedPosition: editor.value.pinnedPosition }),
  };
  if (editor.value.postId)
    await execute(`/api/v1/admin/posts/${editor.value.postId}`, 'PATCH', {
      ...body,
      lockVersion: editor.value.lockVersion,
    });
  else await execute('/api/v1/admin/posts', 'POST', { ...body, boardSlug: editor.value.boardSlug });
}
async function action(
  name: 'publish' | 'schedule' | 'hide' | 'remove' | 'republish' | 'unschedule'
) {
  if (locked.value) return;
  if (dirty.value) {
    message.value = '변경한 내용을 먼저 저장해 주세요.';
    return;
  }
  if (
    name === 'remove' &&
    !confirm('최종 삭제하면 되돌릴 수 없는 삭제 상태가 됩니다. 이 게시글을 최종 삭제할까요?')
  )
    return;
  const body: Record<string, unknown> = { lockVersion: editor.value.lockVersion };
  if (name === 'publish') body.mode = 'IMMEDIATE';
  if (name === 'schedule') {
    body.mode = 'SCHEDULED';
    if (!scheduled.value) {
      message.value = '예약 시각을 입력해 주세요.';
      return;
    }
    const date = new Date(scheduled.value + '+09:00');
    if (!Number.isFinite(+date) || +date < Date.now() + 60000) {
      message.value = '예약은 현재보다 1분 이상 뒤의 KST 시각으로 입력해 주세요.';
      return;
    }
    if (!confirm(`“${editor.value.title}”을 ${kst(date.toISOString())}에 발행하도록 예약할까요?`))
      return;
    body.scheduledAt = date.toISOString();
  }
  if (name === 'hide') {
    if (!confirm(`“${editor.value.title}”을 숨길까요? 공개 목록과 상세에서 즉시 제외됩니다.`))
      return;
    body.reasonCode = hideReason.value;
  }
  if (
    name === 'unschedule' &&
    !confirm(`“${editor.value.title}”의 예약을 취소하고 초안으로 돌릴까요?`)
  )
    return;
  if (name === 'remove') body.reasonCode = 'REMOVE';
  if (name === 'republish') body.pinnedPosition = republishPin.value;
  await execute(
    `/api/v1/admin/posts/${editor.value.postId}${name === 'remove' ? '' : '/' + (name === 'schedule' ? 'publish' : name)}`,
    name === 'remove' ? 'DELETE' : 'POST',
    body
  );
}
async function upload(event: Event) {
  if (locked.value) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const files = [...(input.files ?? [])];
  input.value = '';
  if (!files.length) return;
  const imageCount = editor.value.blocks.filter((b) => b.type === 'IMAGE').length;
  if (imageCount + files.length > 200 || editor.value.blocks.length + files.length > 1000) {
    message.value = '게시글은 본문 블록 1,000개, 이미지 200개까지 사용할 수 있습니다.';
    return;
  }
  busy.value = true;
  taskLabel.value = '이미지를 업로드하는 중…';
  uploadErrors.value = [];
  message.value = '';
  try {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    const result = await $fetch<ApiResponse<'uploadImages'>>('/api/v1/admin/images', {
      method: 'POST',
      body: form,
      retry: 0,
    });
    editor.value.blocks.push(
      ...result.data.items.map((i) => ({ ...i, type: 'IMAGE' as const, alt: '' }))
    );
  } catch (e) {
    const failure = uploadError(apiError(e), files);
    message.value = failure.message;
    uploadErrors.value = failure.details;
  } finally {
    busy.value = false;
  }
}
async function removeBlock(index: number) {
  if (locked.value) return;
  const b = editor.value.blocks[index];
  if (!b) return;
  if (!confirm('이 블록을 제거할까요? 저장 전까지 기존 게시글에는 반영되지 않습니다.')) return;
  busy.value = true;
  taskLabel.value = '블록을 제거하는 중…';
  try {
    if (b.type === 'IMAGE' && !b.attached && 'status' in b && b.status === 'STAGED') {
      const existing = editor.value.postId
        ? await $fetch<ApiResponse<'getPostEditor'>>(`/api/v1/admin/posts/${editor.value.postId}`)
        : null;
      if (!existing?.data.blocks.some((i) => i.type === 'IMAGE' && i.imageId === b.imageId))
        try {
          await $fetch(`/api/v1/admin/images/${b.imageId}`, { method: 'DELETE' });
        } catch {
          message.value = '이미지를 폐기하지 못했습니다.';
          return;
        }
    }
    editor.value.blocks.splice(index, 1);
    validation.value = {};
  } catch {
    message.value = '이미지 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  } finally {
    busy.value = false;
  }
}
function move(index: number, offset: number) {
  if (locked.value) return;
  const next = index + offset;
  if (next < 0 || next >= editor.value.blocks.length) return;
  const value = editor.value.blocks.splice(index, 1)[0];
  if (!value) return;
  editor.value.blocks.splice(next, 0, value);
  validation.value = {};
  void nextTick(() =>
    document
      .querySelector<HTMLElement>(
        `[data-block-index="${next}"] .move-${offset < 0 ? 'up' : 'down'}`
      )
      ?.focus()
  );
}
function retryImages() {
  for (const id of Object.keys(imageFailures.value)) {
    imageFailures.value[Number(id)] = false;
    imageAttempts.value[Number(id)] = (imageAttempts.value[Number(id)] || 0) + 1;
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !locked.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  if (/^[1-9][0-9]*$/.test(String(route.query.postId || ''))) void load(String(route.query.postId));
});
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(
  () => !locked.value && (!dirty.value || confirm('저장하지 않은 변경을 버리고 이동할까요?'))
);
</script>
<template>
  <main class="admin-page">
    <h1>게시글 관리</h1>
    <p v-if="batchItemId">
      <NuxtLink :to="{ path: '/admin/batch', query: { itemId: batchItemId } }"
        >← 수집 검수로 돌아가기</NuxtLink
      >
    </p>
    <p role="status">{{ message }}</p>
    <p v-if="busy" role="status">{{ taskLabel }}</p>
    <div v-if="recovery" role="alert" class="notice">
      <p>저장 결과 확인이 끝날 때까지 이 화면을 유지해 주세요.</p>
      <button :disabled="busy" @click="execute(recovery.path, recovery.method, recovery.body)">
        저장 결과 다시 확인
      </button>
    </div>
    <button v-if="detailRetry && !busy" @click="load(detailRetry)">게시글 다시 불러오기</button>
    <p v-if="conflict" role="alert">
      내 입력은 그대로 보존되어 있습니다. 필요한 내용을 복사한 뒤 ‘최신 내용 확인’을 선택하세요.
      변경을 버리기 전 다시 확인합니다.
    </p>
    <ul v-if="uploadErrors.length" role="alert">
      <li v-for="failure in uploadErrors" :key="failure.index">
        {{ failure.name }}: {{ failure.reason }}
      </li>
    </ul>
    <div class="admin-layout" :class="{ 'editing-mobile': mobileEditor }">
      <aside aria-label="게시글 검색 목록" :aria-busy="searchBusy">
        <h2>게시글 찾기</h2>
        <form @submit.prevent="searchPosts()">
          <label
            >상태<select v-model="status" aria-label="상태">
              <option value="">전체</option>
              <option v-for="s in Object.keys(labels)" :key="s" :value="s">
                {{ stateLabel(s) }}
              </option>
            </select></label
          ><label
            >게시판<select v-model="board" aria-label="게시판">
              <option value="">전체</option>
              <option v-for="b in boards?.data.items" :value="b.slug">{{ b.displayName }}</option>
            </select></label
          ><label>제목 앞부분<input v-model="titlePrefix" maxlength="100" /></label
          ><label>수정 시작 (KST)<input type="datetime-local" v-model="from" /></label
          ><label>수정 종료 (KST)<input type="datetime-local" v-model="to" /></label
          ><button :disabled="searchBusy">{{ searchBusy ? '검색 중…' : '검색' }}</button
          ><button id="new-draft" type="button" @click="newDraft" :disabled="locked">
            새 초안
          </button>
        </form>
        <p v-if="searchBusy" role="status">목록을 불러오는 중…</p>
        <div v-else-if="searchError" role="alert">
          <p>{{ searchError }}</p>
          <button @click="searchPosts(searchRetryPage)">검색 다시 시도</button>
        </div>
        <template v-else>
          <p v-if="!search?.data.items.length" role="status">
            검색 결과가 없습니다. 조건을 바꾸거나 새 초안을 작성해 주세요.
          </p>
          <p v-else class="result-count">{{ search.meta.totalItems }}건 · {{ page }}페이지</p>
          <button
            class="admin-result"
            v-for="item in search?.data.items"
            :key="item.postId"
            :data-post-id="item.postId"
            :aria-current="editor.postId === item.postId ? 'true' : undefined"
            @click="load(item.postId)"
            :disabled="locked"
          >
            {{ item.title
            }}<small>{{ stateLabel(item.status) }} · {{ boardName(item.boardSlug) }}</small
            ><small>수정 {{ kst(item.updatedAt) }}</small></button
          ><PageNumbers
            v-if="search"
            :page="page"
            :total="search.meta.totalPages"
            @change="searchPosts"
          />
        </template>
      </aside>
      <section aria-labelledby="editor-heading" :aria-busy="busy">
        <button class="mobile-back" :disabled="locked" @click="backToList">목록으로</button>
        <h2 id="editor-heading" tabindex="-1">
          {{ editor.postId ? '게시글 편집' : '새 초안 작성' }}
        </h2>
        <p class="save-state">
          {{ stateLabel(editor.status) }} ·
          {{
            dirty ? '저장하지 않은 변경' : editor.postId ? '저장됨' : '작성 후 초안을 저장해 주세요'
          }}
        </p>
        <p v-if="editor.status === 'SCHEDULED' && editor.scheduledAt">
          예약 시각:
          <time :datetime="editor.scheduledAt"
            >{{
              new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(editor.scheduledAt))
            }}
            KST</time
          >
        </p>
        <NuxtLink
          v-if="editor.status === 'PUBLISHED'"
          :to="`/${editor.boardSlug}/posts/${editor.postId}`"
        >
          공개 게시글 보기
        </NuxtLink>
        <button v-if="editor.postId" @click="load(editor.postId)" :disabled="locked">
          최신 내용 확인
        </button>
        <p v-if="!boards?.data.items.length" role="alert">
          게시판 정보를 불러오지 못했습니다.
          <button @click="refreshNuxtData()">게시판 다시 불러오기</button>
        </p>
        <p v-if="editor.status === 'PUBLISHED'">공개 중인 글은 숨김 처리 후 수정할 수 있습니다.</p>
        <p v-if="editor.status === 'REMOVED'">
          삭제된 게시글입니다. 내용은 읽기 전용이며 되돌릴 수 없습니다.
        </p>
        <button
          v-if="!editable && Object.values(imageFailures).some(Boolean)"
          :disabled="busy"
          @click="retryImages"
        >
          이미지 다시 불러오기
        </button>
        <fieldset :disabled="!editable || locked || waiting || !boards?.data.items.length">
          <legend class="sr-only">게시글 내용</legend>
          <label
            >게시판<select v-model="editor.boardSlug" :disabled="!!editor.postId">
              <option v-for="b in boards?.data.items" :value="b.slug">{{ b.displayName }}</option>
            </select></label
          ><label
            >제목<input
              v-model="editor.title"
              maxlength="200"
              :aria-invalid="!!validation.title"
              :aria-describedby="validation.title ? 'error-title' : undefined"
          /></label>
          <p v-if="validation.title" id="error-title" class="field-error">{{ validation.title }}</p>
          <label
            >출처명<input
              v-model="sourceName"
              maxlength="200"
              :aria-invalid="!!validation.sourceName"
              :aria-describedby="validation.sourceName ? 'error-source-name' : undefined"
          /></label>
          <p v-if="validation.sourceName" id="error-source-name" class="field-error">
            {{ validation.sourceName }}
          </p>
          <label
            >출처 URL<input
              v-model="sourceUrl"
              type="url"
              placeholder="https://"
              :aria-invalid="!!validation.sourceUrl"
              :aria-describedby="validation.sourceUrl ? 'error-source-url' : undefined"
          /></label>
          <p v-if="validation.sourceUrl" id="error-source-url" class="field-error">
            {{ validation.sourceUrl }}
          </p>
          <p v-if="!sourceUrl">출처 확인 필요</p>
          <label v-if="editor.status !== 'HIDDEN_REVIEW'"
            >공지 순서<select v-model="editor.pinnedPosition">
              <option :value="null">일반 글</option>
              <option v-for="n in 3" :value="n">공지 {{ n }}</option>
            </select></label
          >
          <p v-if="validation.blocks" class="field-error" role="alert">{{ validation.blocks }}</p>
          <div
            class="block-editor"
            v-for="(block, index) in editor.blocks"
            :key="block.type === 'IMAGE' ? `image-${block.imageId}` : index"
            :data-block-index="index"
          >
            <label v-if="block.type === 'TEXT'"
              >본문 {{ index + 1
              }}<textarea
                v-model="block.text"
                maxlength="20000"
                :aria-invalid="!!validation[`block-${index}`]"
                :aria-describedby="
                  validation[`block-${index}`] ? `error-block-${index}` : undefined
                "
              /></label
            ><template v-else
              ><img
                v-if="block.previewPath && !imageFailures[block.imageId]"
                :src="
                  block.previewPath +
                  (imageAttempts[block.imageId] ? '?retry=' + imageAttempts[block.imageId] : '')
                "
                alt="업로드 미리보기"
                @error="imageFailures[block.imageId] = true" />
              <div v-else-if="block.previewPath" role="alert">
                이미지 미리보기를 불러오지 못했습니다.
                <button
                  v-if="editable"
                  type="button"
                  @click="
                    imageFailures[block.imageId] = false;
                    imageAttempts[block.imageId] = (imageAttempts[block.imageId] || 0) + 1;
                  "
                >
                  이미지 다시 불러오기
                </button>
              </div>
              <p v-else>이미지 없음</p>
              <label
                >대체 텍스트<input
                  v-model="block.alt"
                  maxlength="300"
                  :aria-invalid="!!validation[`block-${index}`]"
                  :aria-describedby="
                    validation[`block-${index}`] ? `error-block-${index}` : undefined
                  " /></label
            ></template>
            <p v-if="validation[`block-${index}`]" :id="`error-block-${index}`" class="field-error">
              {{ validation[`block-${index}`] }}
            </p>
            <button class="move-up" type="button" @click="move(index, -1)" :disabled="index === 0">
              위로</button
            ><button
              type="button"
              class="move-down"
              @click="move(index, 1)"
              :disabled="index === editor.blocks.length - 1"
            >
              아래로</button
            ><button type="button" @click="removeBlock(index)">블록 제거</button>
          </div>
          <button
            type="button"
            :disabled="editor.blocks.length >= 1000"
            @click="editor.blocks.push({ type: 'TEXT', text: '' })"
          >
            텍스트 추가</button
          ><label
            >이미지 추가<input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              @change="upload" /></label
          ><button class="primary" @click="save">
            {{ editor.postId ? '수정 저장' : '초안 생성' }}
          </button>
        </fieldset>
        <div v-if="editor.postId" class="commands">
          <button
            v-if="['DRAFT', 'SCHEDULED'].includes(editor.status || '')"
            :disabled="locked || dirty"
            @click="action('publish')"
            class="primary"
          >
            즉시 발행
          </button>
          <template v-if="editor.status === 'DRAFT'"
            ><button :disabled="locked" @click="scheduleSlot(7, 30)">07:30 KST</button
            ><button :disabled="locked" @click="scheduleSlot(17, 30)">17:30 KST</button
            ><label
              >예약 시각 (KST)<input
                type="datetime-local"
                v-model="scheduled"
                :disabled="locked" /></label
            ><button :disabled="locked || dirty" @click="action('schedule')">예약</button></template
          ><button
            v-if="editor.status === 'SCHEDULED'"
            :disabled="locked || dirty"
            @click="action('unschedule')"
          >
            예약 취소</button
          ><label v-if="editor.status === 'PUBLISHED'"
            >숨김 사유<select v-model="hideReason">
              <option value="RIGHTS_EMAIL">권리 문의</option>
              <option value="EDIT">내용 수정</option>
            </select></label
          ><button v-if="editor.status === 'PUBLISHED'" :disabled="locked" @click="action('hide')">
            숨김</button
          ><template v-if="editor.status === 'HIDDEN_REVIEW'"
            ><label
              >재공개 공지 순서<select v-model="republishPin">
                <option :value="null">일반 글</option>
                <option v-for="n in 3" :value="n">공지 {{ n }}</option>
              </select></label
            >
            <p v-if="waiting">공개 이미지 삭제 중입니다. 최신 내용을 확인해 주세요.</p>
            <button :disabled="locked || dirty || waiting" @click="action('republish')">
              재공개</button
            ><button :disabled="locked || dirty || waiting" @click="action('remove')">
              최종 삭제
            </button></template
          >
        </div>
      </section>
    </div>
  </main>
</template>
<style scoped>
.field-error {
  color: #a32126;
  overflow-wrap: anywhere;
}
[aria-invalid='true'] {
  border-color: #a32126;
}
.admin-layout {
  display: grid;
  grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.7fr);
  gap: 24px;
}
.admin-result {
  display: block;
  text-align: left;
  width: 100%;
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.admin-result small {
  display: block;
}
.block-editor {
  padding: 12px;
  background: #e2f4f3;
  margin: 12px 0;
}
.block-editor img {
  max-width: 100%;
  max-height: 300px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-inline-size: 0;
}
section {
  min-width: 0;
}
input[type='file'] {
  width: 100%;
}
input:not([type='file']) {
  width: 100%;
}
.commands {
  margin-top: 20px;
}
button {
  margin: 3px;
}
@media (max-width: 767px) {
  .admin-layout {
    display: block;
  }
  .admin-layout:not(.editing-mobile) section,
  .admin-layout.editing-mobile aside {
    display: none;
  }
  .mobile-back {
    display: inline-flex;
  }
}
.admin-page {
  max-width: 1200px;
}
nav {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 16px;
  margin-bottom: 24px;
}
h1 {
  margin-bottom: 12px;
}
h2 {
  font-size: 20px;
  margin: 0 0 16px;
}
aside,
section {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 0;
}
label {
  display: block;
  margin-bottom: 12px;
  font-weight: 600;
}
input,
select,
textarea {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: white;
}
textarea {
  min-height: 140px;
  resize: vertical;
}
small,
.result-count {
  color: var(--muted);
  font-weight: normal;
}
.admin-result {
  padding: 12px;
  margin-inline: 0;
}
.admin-result[aria-current='true'] {
  border: 2px solid var(--brand-strong);
  background: var(--brand-soft);
}
.primary {
  background: var(--brand-strong);
  color: white;
  font-weight: 700;
}
.save-state,
.notice {
  padding: 10px;
  background: var(--brand-soft);
  border-radius: 4px;
}
.save-state {
  position: sticky;
  top: 0;
  z-index: 1;
}
.mobile-back {
  display: none;
}
.commands {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: end;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}
.commands label {
  flex: 1 1 100%;
}
@media (max-width: 767px) {
  .mobile-back {
    display: inline-flex;
  }
  aside,
  section {
    padding: 12px;
  }
}
</style>
