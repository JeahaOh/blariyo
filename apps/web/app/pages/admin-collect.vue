<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
definePageMeta({ path: '/admin/collect' });
const requestFetch = useRequestFetch();
const { data: listing, error } = await useAsyncData('collect-list', () =>
  requestFetch<ApiResponse<'listCollectionCandidates'>>('/api/v1/admin/collect/candidates')
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    message: '수집 보조를 사용할 수 없습니다.',
  });
const { data: operationalEvents } = await useAsyncData('collector-events', () =>
  requestFetch<ApiResponse<'listCollectorOperationalEvents'>>(
    '/api/v1/admin/collect/operational-events'
  )
);
const eventLabels: Record<string, string> = {
  NOTIFICATION_FINAL_FAILED: '결과 알림 전송 실패',
  RECONCILE_REQUIRED: '수집 상태 확인 필요',
  SPOOL_CLEANUP_FAILED: '임시 파일 정리 실패',
  LEASE_EXPIRED: '수집 처리 시간 만료',
  QUOTA_INTERVAL_VIOLATION: '출처 요청 간격 확인 필요',
  COLLECTOR_CLOCK_UNSAFE: '수집 서버 시각 확인 필요',
};
async function acknowledgeEvent(eventId: string) {
  try {
    await $fetch(`/api/v1/admin/collect/operational-events/${eventId}/acknowledge`, {
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      retry: 0,
    });
    operationalEvents.value = await $fetch<ApiResponse<'listCollectorOperationalEvents'>>(
      '/api/v1/admin/collect/operational-events'
    );
  } catch {
    message.value = '운영 알림 확인을 저장하지 못했습니다.';
  }
}
const statuses: Record<string, string> = {
  PENDING: '수집 대기',
  RUNNING: '수집 중',
  NEW: '검수 대기',
  FETCH_FAILED: '수집 실패',
  APPROVED: '초안 생성됨',
  REJECTED: '반려됨',
};
const url = ref(''),
  filter = ref(''),
  page = ref(1),
  detail = ref<ApiResponse<'getCollectionCandidate'>['data'] | null>(null),
  busy = ref(false),
  message = ref(''),
  pending = ref<{ signature: string; key: string } | null>(null);
const title = ref(''),
  lead = ref(''),
  selected = ref<number[]>([]),
  alts = ref<Record<string, string>>({}),
  replacements = ref<Record<string, number>>({}),
  ack = ref(false),
  reason = ref('OTHER');
async function refresh(n = page.value) {
  page.value = n;
  listing.value = await $fetch<ApiResponse<'listCollectionCandidates'>>(
    '/api/v1/admin/collect/candidates',
    {
      query: { page: n, ...(filter.value ? { status: filter.value } : {}) },
    }
  );
}
async function open(id: number) {
  if (busy.value) return;
  busy.value = true;
  try {
    detail.value = (
      await $fetch<ApiResponse<'getCollectionCandidate'>>(`/api/v1/admin/collect/candidates/${id}`)
    ).data;
    title.value = detail.value.title || '';
    lead.value = '';
    selected.value = detail.value.contentBlocks
      ? detail.value.imageCandidates.map((i) => i.candidateImageId)
      : [];
    alts.value = Object.fromEntries(
      detail.value.imageCandidates.map((image) => {
        const block = detail.value?.contentBlocks?.find(
          (b) => b.type === 'IMAGE' && b.imagePosition === image.position
        );
        return [image.candidateImageId, block?.type === 'IMAGE' ? block.alt : ''];
      })
    );
    replacements.value = {};
    ack.value = false;
    pending.value = null;
    message.value = '';
  } catch {
    message.value = '후보를 불러오지 못했습니다.';
  } finally {
    busy.value = false;
  }
}
async function action(path: string, body: Record<string, unknown>) {
  if (busy.value) return;
  busy.value = true;
  message.value = '';
  const signature = JSON.stringify({ path, body });
  if (pending.value?.signature !== signature)
    pending.value = { signature, key: crypto.randomUUID() };
  try {
    const r = await $fetch<
      ApiResponse<
        | 'createCollectionCandidate'
        | 'retryCollectionCandidate'
        | 'rejectCollectionCandidate'
        | 'promoteCollectionCandidate'
      >
    >('/api/v1/admin/collect/' + path, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': pending.value.key },
      retry: 0,
    });
    if ('postId' in r.data && r.data.postId) {
      await navigateTo(`/admin?postId=${r.data.postId}`);
      return;
    }
    await refresh();
    if (detail.value)
      detail.value = (
        await $fetch<ApiResponse<'getCollectionCandidate'>>(
          `/api/v1/admin/collect/candidates/${detail.value.candidateId}`
        )
      ).data;
    pending.value = null;
    message.value = '처리했습니다.';
  } catch (e) {
    const code = apiError(e).code;
    message.value = code?.includes('VERSION')
      ? '다른 변경이 있습니다. 후보를 다시 열어 최신 내용을 확인해 주세요.'
      : `처리하지 못했습니다. ${code || '다시 시도해 주세요.'}`;
  } finally {
    busy.value = false;
  }
}
function promote() {
  if (!detail.value) return;
  if (
    (!detail.value.contentBlocks && !selected.value.length) ||
    selected.value.some((id) => !alts.value[id]?.trim())
  ) {
    message.value = '이미지를 선택하고 각 이미지 설명을 입력해 주세요.';
    return;
  }
  if (
    detail.value.contentBlocks &&
    detail.value.imageCandidates.some(
      (image) => !image.previewPath && !replacements.value[image.candidateImageId]
    )
  ) {
    message.value =
      '원문 첨부가 모두 준비되어야 합니다. 누락되거나 만료된 이미지를 다시 올려 주세요.';
    return;
  }
  if (detail.value.duplicatePostId && !ack.value) {
    message.value = '중복 가능 게시글을 확인한 뒤 확인 표시를 해 주세요.';
    return;
  }
  return action(`candidates/${detail.value.candidateId}/draft`, {
    lockVersion: detail.value.lockVersion,
    boardSlug: 'meme',
    title: title.value,
    ...(!detail.value.contentBlocks && lead.value ? { leadText: lead.value } : {}),
    candidateImageIds: selected.value,
    imageOptions: selected.value.map((id) => ({
      candidateImageId: id,
      alt: alts.value[id],
      ...(replacements.value[id] ? { uploadedImageId: replacements.value[id] } : {}),
    })),
    acknowledgeDuplicate: ack.value,
  });
}
async function replace(id: number, event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  if (!file || busy.value) return;
  busy.value = true;
  try {
    const form = new FormData();
    form.append('files', file);
    const r = await $fetch<ApiResponse<'uploadImages'>>('/api/v1/admin/images', {
      method: 'POST',
      body: form,
      retry: 0,
    });
    const image = r.data.items[0];
    if (!image) throw new Error('Missing uploaded image');
    replacements.value[id] = image.imageId;
    message.value = '대체 이미지를 올렸습니다.';
  } catch {
    message.value = '이미지를 올리지 못했습니다. 파일 형식과 크기를 확인해 주세요.';
  } finally {
    busy.value = false;
    input.value = '';
  }
}
</script>
<template>
  <main v-if="listing">
    <h1>수집 후보 검수</h1>
    <section v-if="operationalEvents?.data?.items?.length" aria-label="수집 운영 알림">
      <h2>확인이 필요한 운영 알림</h2>
      <ul>
        <li v-for="event in operationalEvents.data.items" :key="event.eventId">
          {{ eventLabels[event.eventCode] || '수집 서버 확인 필요' }}
          <span v-if="event.candidateId"> · 후보 #{{ event.candidateId }}</span>
          <button type="button" @click="acknowledgeEvent(event.eventId)">확인 처리</button>
        </li>
      </ul>
    </section>
    <nav>
      <NuxtLink to="/admin">게시글 관리</NuxtLink> ·
      <NuxtLink to="/admin/collect/sources">수집 출처</NuxtLink>
    </nav>
    <p>
      URL을 요청하면 로컬 수집기가 처리합니다. 검수 후 만든 초안은 게시글 관리에서 별도로
      발행합니다.
    </p>
    <p role="status">{{ message }}</p>
    <form @submit.prevent="action('candidates', { originUrl: url })">
      <label
        >상세 글 URL<input
          v-model="url"
          type="url"
          pattern="https://.*"
          required
          maxlength="2048"
          placeholder="https://"
          :disabled="busy" /></label
      ><button :disabled="busy">수집 요청</button>
    </form>
    <form @submit.prevent="refresh(1)">
      <label
        >상태<select v-model="filter">
          <option value="">전체</option>
          <option v-for="(label, key) in statuses" :key="key" :value="key">{{ label }}</option>
        </select></label
      ><button :disabled="busy">새로고침</button>
    </form>
    <div class="collect-layout">
      <section aria-label="후보 목록">
        <p v-if="!listing.data.items.length">수집 후보가 없습니다.</p>
        <ul>
          <li v-for="c in listing.data.items" :key="c.candidateId">
            <button :disabled="busy" @click="open(c.candidateId)">
              #{{ c.candidateId }} {{ c.title || c.sourceName }} — {{ statuses[c.status] }}
            </button>
            <p>
              {{ c.sourceName }} · 이미지 {{ c.imageCandidateCount }}개
              <span v-if="c.duplicatePostId">· 중복 가능</span>
            </p>
            <time :datetime="c.fetchedAt || c.requestedAt">{{
              (c.fetchedAt || c.requestedAt).replace('T', ' ').replace('Z', ' UTC')
            }}</time>
            <a :href="c.originUrl" target="_blank" rel="noopener noreferrer">원문</a>
          </li>
        </ul>
        <button :disabled="page <= 1 || busy" @click="refresh(page - 1)">이전</button> {{ page }}
        <button :disabled="listing.data.items.length < 50 || busy" @click="refresh(page + 1)">
          다음
        </button>
      </section>
      <section v-if="detail" aria-label="후보 상세">
        <h2>후보 #{{ detail.candidateId }}</h2>
        <p>{{ statuses[detail.status] }}</p>
        <a :href="detail.originUrl" target="_blank" rel="noopener noreferrer">원문 확인</a>
        <p v-if="detail.fetchErrorCode">수집 실패: {{ detail.fetchErrorCode }}</p>
        <p v-for="warning in detail.warnings" :key="warning">{{ warning }}</p>
        <section v-if="detail.contentBlocks" aria-label="수집한 원문">
          <h3>수집한 원문</h3>
          <p>본문 순서를 유지해 초안으로 옮깁니다. 첨부 이미지가 모두 준비되어야 합니다.</p>
          <template v-for="(block, index) in detail.contentBlocks" :key="index">
            <p v-if="block.type === 'TEXT'" style="white-space: pre-wrap; overflow-wrap: anywhere">
              {{ block.text }}
            </p>
            <p v-else-if="block.type === 'LINK'" style="overflow-wrap: anywhere">
              <a :href="block.url" target="_blank" rel="noopener noreferrer">{{
                block.label || block.url
              }}</a>
            </p>
            <figure v-else>
              <img
                v-if="
                  detail.imageCandidates.find((i) => i.position === block.imagePosition)
                    ?.previewPath
                "
                :src="
                  detail.imageCandidates.find((i) => i.position === block.imagePosition)
                    ?.previewPath ?? undefined
                "
                :alt="block.alt || `원문 이미지 ${block.imagePosition}`"
              />
              <figcaption>원문 이미지 {{ block.imagePosition }}</figcaption>
            </figure>
          </template>
        </section>
        <p v-if="detail.duplicatePostId">
          <NuxtLink :to="`/admin?postId=${detail.duplicatePostId}`"
            >중복 가능 게시글 #{{ detail.duplicatePostId }} 확인</NuxtLink
          >
        </p>
        <form v-if="detail.status === 'NEW'" @submit.prevent="promote">
          <label>제목<input v-model="title" required maxlength="200" :disabled="busy" /></label
          ><label v-if="!detail.contentBlocks"
            >소개 글<textarea v-model="lead" maxlength="5000" :disabled="busy" />
          </label>
          <fieldset v-for="i in detail.imageCandidates" :key="i.candidateImageId" :disabled="busy">
            <legend>이미지 {{ i.position }}</legend>
            <img
              v-if="replacements[i.candidateImageId] || i.previewPath"
              :src="
                replacements[i.candidateImageId]
                  ? `/api/v1/admin/images/${replacements[i.candidateImageId]}/preview`
                  : (i.previewPath ?? undefined)
              "
              alt="검수용 미리보기"
            />
            <p v-else>미리보기가 없거나 만료되었습니다. 이미지를 직접 올려 주세요.</p>
            <label
              ><input
                v-model="selected"
                type="checkbox"
                :value="i.candidateImageId"
                :disabled="
                  !!detail.contentBlocks || (!i.previewPath && !replacements[i.candidateImageId])
                "
              />초안에 포함</label
            ><label>이미지 설명<input v-model="alts[i.candidateImageId]" maxlength="300" /></label
            ><label
              >대체 이미지<input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                @change="replace(i.candidateImageId, $event)"
            /></label>
          </fieldset>
          <label
            ><input v-model="ack" type="checkbox" :disabled="busy" />원문과 이미지의 중복 가능성을
            확인했습니다.</label
          ><button
            :disabled="
              busy ||
              (!detail.contentBlocks && !selected.length) ||
              (!!detail.duplicatePostId && !ack)
            "
          >
            검수 완료 · 초안 만들기
          </button>
        </form>
        <button
          v-if="detail.status === 'FETCH_FAILED'"
          :disabled="busy"
          @click="
            action(`candidates/${detail.candidateId}/retry`, { lockVersion: detail.lockVersion })
          "
        >
          다시 수집
        </button>
        <form
          v-if="['NEW', 'FETCH_FAILED'].includes(detail.status)"
          @submit.prevent="
            action(`candidates/${detail.candidateId}/reject`, {
              lockVersion: detail.lockVersion,
              reasonCode: reason,
            })
          "
        >
          <label
            >반려 사유<select v-model="reason" :disabled="busy">
              <option value="DUPLICATE">중복</option>
              <option value="LOW_QUALITY">품질 부족</option>
              <option value="RIGHTS_RISK">권리 문제</option>
              <option value="NOT_FUNNY">콘텐츠 부적합</option>
              <option value="SOURCE_GONE">원문 없음</option>
              <option value="OTHER">기타</option>
            </select></label
          ><button :disabled="busy">반려</button>
        </form>
        <NuxtLink v-if="detail.postId" :to="`/admin?postId=${detail.postId}`"
          >생성된 초안 열기</NuxtLink
        >
      </section>
    </div>
  </main>
</template>
<style scoped>
.collect-layout {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(0, 2fr);
  gap: 24px;
}
label {
  display: block;
  margin: 12px 0;
}
input:not([type='checkbox']),
textarea {
  width: 100%;
  box-sizing: border-box;
}
img {
  max-width: 100%;
  max-height: 400px;
}
fieldset {
  margin: 16px 0;
}
button {
  margin: 4px;
}
@media (max-width: 650px) {
  .collect-layout {
    grid-template-columns: 1fr;
  }
}
</style>
