<script setup lang="ts">
import { apiError, type ApiResponse, type EditorState } from '~~/shared/api-types';
import type { components } from '@blariyo/contracts/api';
import { uploadError } from '../utils/upload-errors.mjs';
import { editorErrors } from '../utils/editor-validation.mjs';
const route = useRoute();
const uploadErrors = ref<ReturnType<typeof uploadError>['details']>([]);
const validation = ref<Record<string, string>>({});
const requestFetch = useRequestFetch();
const { data: search, error } = await useAsyncData('admin-search', () =>
  requestFetch<ApiResponse<'searchAdminPosts'>>('/api/v1/admin/posts')
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 401,
    message: '관리자 인증이 필요합니다.',
  });
const { data: collectAvailable } = await useAsyncData('collect-available', () =>
  requestFetch('/api/v1/admin/collect/sources')
    .then(() => true)
    .catch(() => false)
);
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
  pending = ref<{ signature: string; key: string } | null>(null);
const republishPin = ref<components['schemas']['PinnedPosition']>(null),
  hideReason = ref('RIGHTS_EMAIL');
function scheduleSlot(hour: number, minute: number) {
  const kst = new Date(Date.now() + 9 * 3600000);
  let time = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), hour - 9, minute)
  );
  if (+time < Date.now() + 60000) time = new Date(+time + 86400000);
  scheduled.value = new Date(+time - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
  if (busy.value) return;
  if (dirty.value && !confirm('저장하지 않은 변경을 버리고 이동할까요?')) return;
  busy.value = true;
  try {
    const result = await $fetch<ApiResponse<'getPostEditor'>>(`/api/v1/admin/posts/${id}`);
    editor.value = result.data;
    sourceName.value = result.data.source?.name || '';
    sourceUrl.value = result.data.source?.url || '';
    pending.value = null;
    validation.value = {};
    uploadErrors.value = [];
    message.value = '';
    remember();
  } catch {
    message.value = '게시글을 불러오지 못했습니다.';
  } finally {
    busy.value = false;
  }
}
function newDraft() {
  if (busy.value) return;
  if (dirty.value && !confirm('저장하지 않은 변경을 버리고 새 초안을 만들까요?')) return;
  editor.value = fresh();
  sourceName.value = '';
  sourceUrl.value = '';
  pending.value = null;
  validation.value = {};
  uploadErrors.value = [];
  message.value = '';
  remember();
}
async function searchPosts(n = 1) {
  page.value = n;
  try {
    search.value = await $fetch<ApiResponse<'searchAdminPosts'>>('/api/v1/admin/posts', {
      query: {
        ...(status.value ? { status: status.value } : {}),
        ...(board.value ? { board: board.value } : {}),
        ...(titlePrefix.value ? { titlePrefix: titlePrefix.value } : {}),
        ...(from.value ? { from: new Date(from.value).toISOString() } : {}),
        ...(to.value ? { to: new Date(to.value).toISOString() } : {}),
        page: n,
      },
    });
  } catch {
    message.value = '검색 조건을 확인해 주세요.';
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
    pending.value = { signature, key: crypto.randomUUID() };
  busy.value = true;
  message.value = '';
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
    const resultDetail = await $fetch<ApiResponse<'getPostEditor'>>(
      `/api/v1/admin/posts/${result.data.postId}`
    );
    pending.value = null;
    editor.value = resultDetail.data;
    sourceName.value = editor.value.source?.name || '';
    sourceUrl.value = editor.value.source?.url || '';
    remember();
    await searchPosts(page.value);
    message.value = '저장했습니다.';
  } catch (e) {
    message.value =
      apiError(e).code === 'POST_VERSION_CONFLICT'
        ? '다른 변경이 반영되었습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.'
        : `처리하지 못했습니다. ${apiError(e).code || '다시 시도해 주세요.'}`;
  } finally {
    busy.value = false;
  }
}
async function save() {
  if (busy.value) return;
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
  if (busy.value) return;
  if (dirty.value) {
    message.value = '변경한 내용을 먼저 저장해 주세요.';
    return;
  }
  if (
    name === 'remove' &&
    !confirm('최종 삭제하면 되돌릴 수 없는 REMOVED 상태가 됩니다. 최종 삭제할까요?')
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
    body.scheduledAt = new Date(scheduled.value).toISOString();
  }
  if (name === 'hide') body.reasonCode = hideReason.value;
  if (name === 'remove') body.reasonCode = 'REMOVE';
  if (name === 'republish') body.pinnedPosition = republishPin.value;
  await execute(
    `/api/v1/admin/posts/${editor.value.postId}${name === 'remove' ? '' : '/' + (name === 'schedule' ? 'publish' : name)}`,
    name === 'remove' ? 'DELETE' : 'POST',
    body
  );
}
async function upload(event: Event) {
  if (busy.value) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const files = [...(input.files ?? [])];
  input.value = '';
  if (!files.length) return;
  const imageCount = editor.value.blocks.filter((b) => b.type === 'IMAGE').length;
  if (imageCount + files.length > 20 || editor.value.blocks.length + files.length > 40) {
    message.value = '게시글은 본문 블록 40개, 이미지 20개까지 사용할 수 있습니다.';
    return;
  }
  busy.value = true;
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
  if (busy.value) return;
  const b = editor.value.blocks[index];
  if (!b) return;
  busy.value = true;
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
  const next = index + offset;
  if (next < 0 || next >= editor.value.blocks.length) return;
  const value = editor.value.blocks.splice(index, 1)[0];
  if (!value) return;
  editor.value.blocks.splice(next, 0, value);
  validation.value = {};
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !busy.value) return;
  event.preventDefault();
  event.returnValue = '';
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  if (/^[1-9][0-9]*$/.test(String(route.query.postId || ''))) void load(String(route.query.postId));
});
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(
  () => !busy.value && (!dirty.value || confirm('저장하지 않은 변경을 버리고 이동할까요?'))
);
</script>
<template>
  <main>
    <h1>게시글 관리</h1>
    <NuxtLink v-if="collectAvailable" to="/admin/collect">수집 후보 검수</NuxtLink>
    <p role="status">{{ message }}</p>
    <ul v-if="uploadErrors.length" role="alert">
      <li v-for="failure in uploadErrors" :key="failure.index">
        {{ failure.name }}: {{ failure.reason }}
      </li>
    </ul>
    <div class="admin-layout">
      <aside>
        <form @submit.prevent="searchPosts()">
          <label
            >상태<select v-model="status">
              <option value="">전체</option>
              <option v-for="s in ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED']">
                {{ s }}
              </option>
            </select></label
          ><label
            >게시판<select v-model="board">
              <option value="">전체</option>
              <option v-for="b in boards?.data.items" :value="b.slug">{{ b.displayName }}</option>
            </select></label
          ><label>제목 앞부분<input v-model="titlePrefix" maxlength="100" /></label
          ><label>수정 시작<input type="datetime-local" v-model="from" /></label
          ><label>수정 종료<input type="datetime-local" v-model="to" /></label><button>검색</button
          ><button type="button" @click="newDraft" :disabled="busy">새 초안</button>
        </form>
        <button
          class="admin-result"
          v-for="item in search?.data.items"
          :key="item.postId"
          @click="load(item.postId)"
          :disabled="busy"
        >
          {{ item.title }}<small>{{ item.status }} · v{{ item.lockVersion }}</small></button
        ><PageNumbers
          v-if="search"
          :page="page"
          :total="search.meta.totalPages"
          @change="searchPosts"
        />
      </aside>
      <section>
        <p>
          {{ editor.status || '새 초안' }}
          <span v-if="editor.lockVersion">· v{{ editor.lockVersion }}</span>
          {{ dirty ? '· 저장하지 않은 변경' : '' }}
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
        <button v-if="editor.postId" @click="load(editor.postId)" :disabled="busy">
          최신 내용 확인
        </button>
        <fieldset :disabled="!editable || busy || waiting">
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
          <div class="block-editor" v-for="(block, index) in editor.blocks" :key="index">
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
              ><img v-if="block.previewPath" :src="block.previewPath" alt="업로드 미리보기" />
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
            <button type="button" @click="move(index, -1)" :disabled="index === 0">위로</button
            ><button
              type="button"
              @click="move(index, 1)"
              :disabled="index === editor.blocks.length - 1"
            >
              아래로</button
            ><button type="button" @click="removeBlock(index)">블록 제거</button>
          </div>
          <button
            type="button"
            :disabled="editor.blocks.length >= 40"
            @click="editor.blocks.push({ type: 'TEXT', text: '' })"
          >
            텍스트 추가</button
          ><label
            >이미지 추가<input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              @change="upload" /></label
          ><button @click="save">{{ editor.postId ? '수정 저장' : '초안 생성' }}</button>
        </fieldset>
        <div v-if="editor.postId" class="commands">
          <button
            v-if="['DRAFT', 'SCHEDULED'].includes(editor.status || '')"
            :disabled="busy || dirty"
            @click="action('publish')"
          >
            즉시 발행
          </button>
          <template v-if="editor.status === 'DRAFT'"
            ><button @click="scheduleSlot(7, 30)">07:30 KST</button
            ><button @click="scheduleSlot(17, 30)">17:30 KST</button
            ><label
              >예약 시각 (기기 시간대)<input type="datetime-local" v-model="scheduled" /></label
            ><button :disabled="busy || dirty" @click="action('schedule')">예약</button></template
          ><button
            v-if="editor.status === 'SCHEDULED'"
            :disabled="busy || dirty"
            @click="action('unschedule')"
          >
            예약 취소</button
          ><label v-if="editor.status === 'PUBLISHED'"
            >숨김 사유<select v-model="hideReason">
              <option value="RIGHTS_EMAIL">권리 문의</option>
              <option value="EDIT">내용 수정</option>
            </select></label
          ><button v-if="editor.status === 'PUBLISHED'" :disabled="busy" @click="action('hide')">
            숨김</button
          ><template v-if="editor.status === 'HIDDEN_REVIEW'"
            ><label
              >재공개 공지 순서<select v-model="republishPin">
                <option :value="null">일반 글</option>
                <option v-for="n in 3" :value="n">공지 {{ n }}</option>
              </select></label
            >
            <p v-if="waiting">공개 이미지 삭제 중입니다. 최신 내용을 확인해 주세요.</p>
            <button :disabled="busy || dirty || waiting" @click="action('republish')">재공개</button
            ><button :disabled="busy || dirty || waiting" @click="action('remove')">
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
  grid-template-columns: 260px minmax(0, 1fr);
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
@media (max-width: 768px) {
  .admin-layout {
    display: block;
  }
  aside {
    margin-bottom: 30px;
  }
}
</style>
