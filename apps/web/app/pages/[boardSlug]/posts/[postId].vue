<script setup lang="ts">
import type { ApiResponse, PostListItem } from '~~/shared/api-types';
import { loadKakao } from '~/utils/kakao.mjs';
import { description } from '~/utils/metadata.mjs';
import { socialDisplayBlocks } from '~/utils/social-posts';
const route = useRoute();
const { data, error } = await useFetch<ApiResponse<'getPost'>>(
  `/api/v1/boards/${String(route.params.boardSlug)}/posts/${String(route.params.postId)}`
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    statusMessage: '게시글을 찾을 수 없습니다.',
  });
if (!data.value)
  throw createError({ statusCode: 503, statusMessage: '게시글을 찾을 수 없습니다.' });
const post = data.value.data.post;
const bodyBlocks = socialDisplayBlocks(post.blocks);
const context = ref(data.value.data.context);
const sharing = ref(false),
  feedback = ref(''),
  shareDialog = ref<HTMLDialogElement | null>(null),
  kakao = shallowRef<Awaited<ReturnType<typeof loadKakao>>>(null);
const { $analytics } = useNuxtApp();
const initialPath = route.fullPath;
const articleBody = ref<HTMLElement | null>(null);
const depthMarkers = new Map<number, Element>();
let pageActive = true;
const analyticsBase = () => ({
  page_content_key: post.analyticsContentKey,
  board_slug: post.board.slug,
});
const makeKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
const canTrackPage = () => pageActive && route.fullPath === initialPath;
const recordShareResult = (
  method: 'copy' | 'native' | 'kakao' | 'x',
  attemptKey: string,
  outcome: 'copied' | 'browser_resolved' | 'cancelled' | 'failed' | 'unavailable' | 'handoff',
  viewToken?: { isCurrent: () => boolean } | null,
  parentAttemptKey?: string
) => {
  if (!canTrackPage() || !viewToken?.isCurrent()) return;
  $analytics?.send('share_result', {
    ...analyticsBase(),
    share_method: method,
    share_attempt_key: attemptKey,
    share_outcome: outcome,
    ...(parentAttemptKey ? { parent_attempt_key: parentAttemptKey } : {}),
  });
};
function openShare() {
  if (sharing.value) return;
  $analytics?.send('share_open', analyticsBase());
  sharing.value = true;
  void nextTick(() => shareDialog.value?.showModal());
}
function closeShare() {
  sharing.value = false;
  shareDialog.value?.close();
}
function shareKakao() {
  const attemptKey = makeKey();
  const viewToken = $analytics?.captureView?.();
  $analytics?.send('share', {
    ...analyticsBase(),
    share_method: 'kakao',
    share_attempt_key: attemptKey,
  });
  try {
    if (!kakao.value) {
      recordShareResult('kakao', attemptKey, 'unavailable', viewToken);
      feedback.value = '카카오톡 공유를 열지 못했습니다. 링크 복사를 이용해 주세요.';
      return;
    }
    kakao.value.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: post.title,
        description: summary,
        imageUrl:
          post.blocks.find((b) => b.type === 'IMAGE')?.image.url ||
          new URL('/og/blariyo-default.png', post.shareUrl).href,
        link: { mobileWebUrl: post.shareUrl, webUrl: post.shareUrl },
      },
    });
    recordShareResult('kakao', attemptKey, 'handoff', viewToken);
  } catch {
    recordShareResult('kakao', attemptKey, 'failed', viewToken);
    feedback.value = '카카오톡 공유를 열지 못했습니다. 링크 복사를 이용해 주세요.';
  }
}
function shareX() {
  const attemptKey = makeKey();
  const viewToken = $analytics?.captureView?.();
  $analytics?.send('share', {
    ...analyticsBase(),
    share_method: 'x',
    share_attempt_key: attemptKey,
  });
  recordShareResult('x', attemptKey, 'handoff', viewToken);
}
const brand = useRuntimeConfig().public;
const summary = description(post.blocks, brand.homeOgDescription);
useSeoMeta({
  title: `${post.title} · ${brand.siteName}`,
  description: summary,
  ogTitle: post.title,
  ogDescription: summary,
  ogUrl: post.shareUrl,
  ogType: 'article',
  ogSiteName: brand.siteName,
  twitterTitle: post.title,
  twitterDescription: summary,
  twitterCard: 'summary_large_image',
  ogImage:
    post.blocks.find((b) => b.type === 'IMAGE')?.image.url ||
    new URL('/og/blariyo-default.png', post.shareUrl).href,
  twitterImage:
    post.blocks.find((b) => b.type === 'IMAGE')?.image.url ||
    new URL('/og/blariyo-default.png', post.shareUrl).href,
});
useHead({ link: [{ rel: 'canonical', href: post.shareUrl }] });
if (import.meta.server) useResponseHeader('Cache-Control').value = 'no-store';
const sentDepths = new Set<number>();
const markerTimers = new Map<number, ReturnType<typeof setTimeout>>();
let depthObserver: IntersectionObserver | undefined;
let articleObserver: IntersectionObserver | undefined;
let bodyResizeObserver: ResizeObserver | undefined;
let activeTimer: ReturnType<typeof setInterval> | undefined;
let articleIntersectsViewport = false;
let activeSince: number | null = null;
let activeMilliseconds = 0;
let detailListInstanceKey = '';
let listRequestGeneration = 0;
const setDepthMarkerRef = (level: number, element: Element | null) => {
  if (element) depthMarkers.set(level, element);
  else depthMarkers.delete(level);
};
function stopMarkerTimers() {
  markerTimers.forEach((timer) => clearTimeout(timer));
  markerTimers.clear();
}
function observeDepthMarkers() {
  depthObserver?.disconnect();
  stopMarkerTimers();
  if (!('IntersectionObserver' in window) || document.visibilityState !== 'visible') return;
  depthObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;
        const level = Number(entry.target.dataset.depth);
        if (!entry.isIntersecting || sentDepths.has(level)) {
          const timer = markerTimers.get(level);
          if (timer) clearTimeout(timer);
          markerTimers.delete(level);
          continue;
        }
        if (!markerTimers.has(level))
          markerTimers.set(
            level,
            setTimeout(() => {
              markerTimers.delete(level);
              if (
                document.visibilityState === 'visible' &&
                $analytics?.isReady?.() &&
                $analytics.send('scroll', {
                  page_content_key: post.analyticsContentKey,
                  depth_percent: level,
                })
              )
                sentDepths.add(level);
            }, 1000)
          );
      }
    },
    { threshold: 0.5 }
  );
  for (const marker of depthMarkers.values()) depthObserver.observe(marker);
}
function emitEngagement(flushReason: 'interval' | 'hidden' | 'blur' | 'navigation' | 'pagehide') {
  if (activeMilliseconds <= 0) return;
  const activeMs = Math.min(60000, Math.floor(activeMilliseconds));
  activeMilliseconds = 0;
  $analytics?.send('content_engagement', {
    page_content_key: post.analyticsContentKey,
    active_ms: activeMs,
    flush_reason: flushReason,
  });
}
function updateEngagement(
  flushReason?: 'interval' | 'hidden' | 'blur' | 'navigation' | 'pagehide'
) {
  const now = performance.now();
  if (activeSince !== null) {
    const elapsed = now - activeSince;
    if (elapsed >= 0 && elapsed <= 60000) activeMilliseconds += elapsed;
    activeSince = null;
  }
  const shouldCount =
    pageActive &&
    route.fullPath === initialPath &&
    articleIntersectsViewport &&
    document.visibilityState === 'visible' &&
    document.hasFocus() &&
    $analytics?.isReady?.() === true;
  if (shouldCount) activeSince = now;
  if (flushReason && (!shouldCount || activeMilliseconds >= 15000)) emitEngagement(flushReason);
  else if (!shouldCount && activeMilliseconds > 0) emitEngagement(flushReason || 'hidden');
  else if (shouldCount && activeMilliseconds >= 15000) emitEngagement('interval');
}
function updateArticleIntersection() {
  const rect = articleBody.value?.getBoundingClientRect();
  articleIntersectsViewport = !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
  updateEngagement(articleIntersectsViewport ? undefined : 'hidden');
}
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    observeDepthMarkers();
    updateEngagement('hidden');
  } else {
    observeDepthMarkers();
    updateArticleIntersection();
  }
}
function onWindowBlur() {
  updateEngagement('blur');
}
function onAnalyticsReady() {
  observeDepthMarkers();
  updateArticleIntersection();
}
onMounted(() => {
  void loadKakao(brand, window, document).then((value) => {
    kakao.value = value;
  });
  $fetch(`/api/v1/boards/${post.board.slug}/posts/${post.postId}/views`, {
    method: 'POST',
    retry: 0,
  }).catch(() => {});
  void nextTick(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        observeDepthMarkers();
        if (articleBody.value && 'IntersectionObserver' in window) {
          articleObserver = new IntersectionObserver((entries) => {
            articleIntersectsViewport = entries.some((entry) => entry.isIntersecting);
            updateEngagement(articleIntersectsViewport ? undefined : 'hidden');
          });
          articleObserver.observe(articleBody.value);
          bodyResizeObserver = new ResizeObserver(observeDepthMarkers);
          bodyResizeObserver.observe(articleBody.value);
        } else updateArticleIntersection();
      })
    );
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blariyo-analytics-ready', onAnalyticsReady);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('focus', updateArticleIntersection);
  window.addEventListener('scroll', updateArticleIntersection, { passive: true });
  window.addEventListener('pagehide', () => updateEngagement('pagehide'), { once: true });
  activeTimer = setInterval(() => updateEngagement('interval'), 1000);
});
onBeforeUnmount(() => {
  pageActive = false;
  updateEngagement('navigation');
  listRequestGeneration++;
  if (activeTimer) clearInterval(activeTimer);
  depthObserver?.disconnect();
  articleObserver?.disconnect();
  bodyResizeObserver?.disconnect();
  stopMarkerTimers();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('blariyo-analytics-ready', onAnalyticsReady);
  window.removeEventListener('blur', onWindowBlur);
  window.removeEventListener('focus', updateArticleIntersection);
  window.removeEventListener('scroll', updateArticleIntersection);
});
async function changePage(page: number) {
  const fromPage = context.value.listPage;
  if (page === fromPage) return;
  const requestGeneration = ++listRequestGeneration;
  try {
    const result = await $fetch<ApiResponse<'listPosts'>>(
      `/api/v1/boards/${post.board.slug}/posts`,
      { query: { page }, retry: 0 }
    );
    if (requestGeneration !== listRequestGeneration || result.meta.pageSize !== 20) return;
    const mark = (items: PostListItem[]) =>
      items.map((item) => ({ ...item, ...(item.postId === post.postId ? { current: true } : {}) }));
    context.value = {
      ...result.data,
      ...result.meta,
      items: mark(result.data.items),
      pinnedItems: mark(result.data.pinnedItems),
      listPage: page,
      pageSize: result.meta.pageSize,
    };
    await nextTick();
    if (requestGeneration !== listRequestGeneration || page === fromPage) return;
    if (detailListInstanceKey)
      $analytics?.send('list_page_change', {
        list_area: 'detail_footer',
        from_list_page: fromPage,
        to_list_page: page,
        list_instance_key: detailListInstanceKey,
      });
  } catch {
    if (requestGeneration === listRequestGeneration)
      feedback.value = '목록을 불러오지 못했습니다. 다시 시도해 주세요.';
  }
}
async function copy(parentAttemptKey?: string) {
  const attemptKey = makeKey();
  const viewToken = $analytics?.captureView?.();
  $analytics?.send('share', {
    ...analyticsBase(),
    share_method: 'copy',
    share_attempt_key: attemptKey,
    ...(parentAttemptKey ? { parent_attempt_key: parentAttemptKey } : {}),
  });
  try {
    await navigator.clipboard.writeText(post.shareUrl);
    recordShareResult('copy', attemptKey, 'copied', viewToken, parentAttemptKey);
    feedback.value = '링크를 복사했습니다.';
  } catch {
    recordShareResult('copy', attemptKey, 'failed', viewToken, parentAttemptKey);
    feedback.value = `주소를 복사해 주세요: ${post.shareUrl}`;
  }
}
async function share() {
  const attemptKey = makeKey();
  const viewToken = $analytics?.captureView?.();
  $analytics?.send('share', {
    ...analyticsBase(),
    share_method: 'native',
    share_attempt_key: attemptKey,
  });
  try {
    if (navigator.share) {
      await navigator.share({ title: post.title, url: post.shareUrl });
      recordShareResult('native', attemptKey, 'browser_resolved', viewToken);
    } else {
      recordShareResult('native', attemptKey, 'unavailable', viewToken);
      await copy(attemptKey);
    }
  } catch (e) {
    recordShareResult(
      'native',
      attemptKey,
      e instanceof Error && e.name === 'AbortError' ? 'cancelled' : 'failed',
      viewToken
    );
    if (!(e instanceof Error) || e.name !== 'AbortError')
      feedback.value = '공유하지 못했습니다. 링크 복사를 이용해 주세요.';
  }
}
</script>
<template>
  <main class="detail-page">
    <div class="detail-nav" aria-label="게시글 탐색">
      <NuxtLink :to="`/${post.board.slug}`" aria-label="목록으로">←</NuxtLink
      ><strong>{{ post.title }}</strong
      ><button @click="openShare" aria-label="공유하기" class="icon-button">
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
        </svg>
      </button>
    </div>
    <article>
      <div class="article-header">
        <h1>{{ post.title }}</h1>
        <p class="muted">
          {{ post.postId }} · {{ post.authorLabel }} · 조회 {{ post.viewCount }} ·
          <time :datetime="post.publishedAt">{{
            new Intl.DateTimeFormat('ko-KR', {
              timeZone: 'Asia/Seoul',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(post.publishedAt))
          }}</time>
        </p>
      </div>
      <div ref="articleBody" class="article-body">
        <template v-for="(block, i) in bodyBlocks" :key="i"
          ><p v-if="block.kind === 'TEXT'" class="body-text"><LinkedText :text="block.text" /></p>
          <XPost v-else-if="block.kind === 'X'" :card="block" />
          <SocialPost v-else-if="block.kind === 'SOCIAL'" :reference="block.reference" />
          <p v-else-if="block.kind === 'LINK'" class="body-text">
            <a :href="block.url" target="_blank" rel="noopener noreferrer">TikTok에서 보기 ↗</a>
          </p>
          <img
            v-else
            :src="block.image.url"
            :alt="block.image.alt"
            :width="block.image.width"
            :height="block.image.height"
        /></template>
        <p v-if="post.source" class="post-source">
          <a :href="post.source.url" target="_blank" rel="noopener noreferrer">{{
            post.source.name
          }}</a>
        </p>
        <span
          v-for="level in [25, 50, 75, 100]"
          :key="level"
          :ref="(element) => setDepthMarkerRef(level, element as Element | null)"
          class="analytics-depth-marker"
          :data-depth="level"
          :style="{ top: `${level}%` }"
          aria-hidden="true"
        />
      </div>
    </article>
    <div class="section-heading">
      <h2>{{ post.board.displayName }}</h2>
      <NuxtLink :to="`/${post.board.slug}`">목록으로</NuxtLink>
    </div>
    <PostList
      v-bind="context"
      list-area="detail_footer"
      @instance-change="detailListInstanceKey = $event"
    /><PageNumbers :page="context.listPage" :total="context.totalPages" @change="changePage" />
    <dialog
      ref="shareDialog"
      class="share-dialog"
      aria-label="공유하기"
      @close="sharing = false"
      @click="(e) => e.target === shareDialog && closeShare()"
    >
      <button class="dialog-close" @click="closeShare">닫기</button>
      <h2>공유하기</h2>
      <div class="share-options">
        <button @click="() => copy()">링크 복사</button><button @click="share">브라우저 공유</button
        ><button v-if="kakao" @click="shareKakao">카카오톡</button
        ><a
          @click="shareX()"
          :href="`https://twitter.com/intent/tweet?url=${encodeURIComponent(post.shareUrl)}`"
          target="_blank"
          rel="noopener noreferrer"
          >X에 공유</a
        >
      </div>
      <p role="status">{{ feedback }}</p>
    </dialog>
    <p v-if="!sharing && feedback" role="status">{{ feedback }}</p>
  </main>
</template>

<style scoped>
.share-dialog {
  top: 62px;
  left: auto;
  right: max(24px, calc((100vw - 760px) / 2 + 24px));
  margin: 0;
  width: 340px;
}
@media (max-width: 767px) {
  .share-dialog {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    padding-bottom: max(24px, env(safe-area-inset-bottom));
  }
}
</style>
