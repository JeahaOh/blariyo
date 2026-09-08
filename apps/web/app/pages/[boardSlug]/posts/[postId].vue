<script setup>
import { loadKakao } from '~/utils/kakao.mjs';
import { description } from '~/utils/metadata.mjs';
const route = useRoute();
const { data, error } = await useFetch(
  `/api/v1/boards/${route.params.boardSlug}/posts/${route.params.postId}`
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    statusMessage: '게시글을 찾을 수 없습니다.',
  });
const post = data.value.data.post;
const context = ref(data.value.data.context);
const sharing = ref(false),
  feedback = ref(''),
  shareDialog = ref(null),
  kakao = shallowRef(null);
const { $analytics } = useNuxtApp();
function openShare() {
  sharing.value = true;
  nextTick(() => shareDialog.value.showModal());
}
function closeShare() {
  sharing.value = false;
  shareDialog.value.close();
}
function shareKakao() {
  try {
    $analytics?.send('share', { share_method: 'kakao', board_slug: post.board.slug });
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
  } catch {
    feedback.value = '카카오톡 공유를 열지 못했습니다. 링크 복사를 이용해 주세요.';
  }
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
onMounted(() => {
  loadKakao(brand, window, document).then((value) => {
    kakao.value = value;
  });
  $fetch(`/api/v1/boards/${post.board.slug}/posts/${post.postId}/views`, {
    method: 'POST',
    retry: 0,
  }).catch(() => {});
});
const depths = new Set();
function trackScroll() {
  const maximum = document.documentElement.scrollHeight - innerHeight;
  const percentage = maximum > 0 ? (scrollY / maximum) * 100 : 100;
  for (const level of [25, 50, 75, 100])
    if (percentage >= level && !depths.has(level)) {
      depths.add(level);
      $analytics?.send('scroll', { page_type: 'detail', scroll_depth_bucket: String(level) });
    }
}
onMounted(() => window.addEventListener('scroll', trackScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', trackScroll));
async function changePage(page) {
  try {
    const result = await $fetch(`/api/v1/boards/${post.board.slug}/posts`, { query: { page } });
    const mark = (items) =>
      items.map((item) => ({ ...item, ...(item.postId === post.postId ? { current: true } : {}) }));
    context.value = {
      ...result.data,
      ...result.meta,
      items: mark(result.data.items),
      pinnedItems: mark(result.data.pinnedItems),
      listPage: page,
    };
  } catch {
    feedback.value = '목록을 불러오지 못했습니다. 다시 시도해 주세요.';
  }
}
async function copy() {
  $analytics?.send('share', { share_method: 'copy', board_slug: post.board.slug });
  try {
    await navigator.clipboard.writeText(post.shareUrl);
    feedback.value = '링크를 복사했습니다.';
  } catch {
    feedback.value = `주소를 복사해 주세요: ${post.shareUrl}`;
  }
}
async function share() {
  $analytics?.send('share', { share_method: 'native', board_slug: post.board.slug });
  try {
    if (navigator.share) await navigator.share({ title: post.title, url: post.shareUrl });
    else await copy();
  } catch (e) {
    if (e.name !== 'AbortError') feedback.value = '공유하지 못했습니다. 링크 복사를 이용해 주세요.';
  }
}
</script>
<template>
  <main>
    <div class="detail-nav">
      <NuxtLink :to="`/${post.board.slug}`" aria-label="목록으로">←</NuxtLink
      ><strong>{{ post.title }}</strong
      ><button @click="openShare" aria-label="공유하기">공유</button>
    </div>
    <article>
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
      <template v-for="(block, i) in post.blocks" :key="i"
        ><p v-if="block.type === 'TEXT'" class="body-text">{{ block.text }}</p>
        <img
          v-else
          :src="block.image.url"
          :alt="block.image.alt"
          :width="block.image.width"
          :height="block.image.height"
      /></template>
      <p v-if="post.source">
        <a :href="post.source.url" target="_blank" rel="noopener noreferrer">{{
          post.source.name
        }}</a>
      </p>
    </article>
    <PostList v-bind="context" /><PageNumbers
      :page="context.listPage"
      :total="context.totalPages"
      @change="changePage"
    />
    <dialog
      ref="shareDialog"
      class="share-dialog"
      aria-label="공유하기"
      @close="sharing = false"
      @click="(e) => e.target === shareDialog && closeShare()"
    >
      <button @click="closeShare">닫기</button>
      <h2>공유하기</h2>
      <button @click="copy">링크 복사</button><button @click="share">브라우저 공유</button
      ><button v-if="kakao" @click="shareKakao">카카오톡</button
      ><a
        @click="$analytics?.send('share', { share_method: 'x', board_slug: post.board.slug })"
        :href="`https://twitter.com/intent/tweet?url=${encodeURIComponent(post.shareUrl)}`"
        target="_blank"
        rel="noopener noreferrer"
        >X에 공유</a
      >
      <p role="status">{{ feedback }}</p>
    </dialog>
    <p v-if="!sharing && feedback" role="status">{{ feedback }}</p>
  </main>
</template>

<style scoped>
.share-dialog {
  top: 86px;
  left: auto;
  right: max(24px, calc((100vw - 760px) / 2 + 24px));
  margin: 0;
  width: 340px;
}
@media (max-width: 600px) {
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
