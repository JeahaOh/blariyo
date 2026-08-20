<script setup lang="ts">
import type { PostDetailResponse } from '~/types/publicContent'

const route = useRoute()
const config = useRuntimeConfig()
const boardSlug = String(route.params.boardSlug)
const postId = String(route.params.postId)
const endpoint = `/api/v1/boards/${encodeURIComponent(boardSlug)}/posts/${encodeURIComponent(postId)}`
const { data, error } = await useFetch<PostDetailResponse>(endpoint)
const notFound = error.value?.statusCode === 404
const cacheControl = useResponseHeader('Cache-Control')

if (notFound) {
  cacheControl.value = 'no-store'
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404, 'Not Found')
  useSeoMeta({
    title: '볼 수 없는 게시글입니다 | 블라리요',
    robots: 'noindex, nofollow',
  })
} else if (error.value || !data.value) {
  throw createError({
    statusCode: error.value?.statusCode || 503,
    statusMessage: '게시글을 불러오지 못했습니다.',
  })
}

const response = data.value || null
const post = response?.data.post || null
const { track } = usePublicEvent()

if (post) {
  const canonical = `${config.public.siteBaseUrl}/${post.board.slug}/posts/${post.postId}`
  const text = post.blocks.find((block) => block.type === 'TEXT')
  const image = post.blocks.find((block) => block.type === 'IMAGE')
  const description = text?.type === 'TEXT' ? text.text.slice(0, 160) : post.title
  const ogImage = image?.type === 'IMAGE'
    ? image.image.url
    : `${config.public.siteBaseUrl}/og/default-1200x630.jpg`

  useHead({ link: [{ rel: 'canonical', href: canonical }] })
  useSeoMeta({
    title: `${post.title} | 블라리요`,
    description,
    ogSiteName: '블라리요',
    ogLocale: 'ko_KR',
    ogType: 'article',
    ogUrl: canonical,
    ogTitle: post.title,
    ogDescription: description,
    ogImage,
    twitterCard: 'summary_large_image',
    twitterTitle: post.title,
    twitterDescription: description,
    twitterImage: ogImage,
  })
}

onMounted(() => {
  if (!post || !response) return
  track({ eventType: 'POST_VIEW', boardSlug: post.board.slug, postId: post.postId })
  track({
    eventType: 'DETAIL_LIST_VIEW',
    boardSlug: post.board.slug,
    postId: post.postId,
    listPage: response.data.context.listPage,
    itemCount: response.data.context.items.length,
  })
})

function publishedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
</script>

<template>
  <template v-if="post && response">
    <SiteHeader :detail-title="post.title" :board-path="`/${post.board.slug}`">
      <template #action><ShareButton :title="post.title" :url="post.shareUrl" /></template>
    </SiteHeader>
    <main class="site-shell">
      <article class="article">
      <header class="article-header">
        <h1>{{ post.title }}</h1>
        <div class="post-meta">
          <span>{{ post.authorLabel }}</span>
          <span>No.{{ post.postId }}</span>
          <time :datetime="post.publishedAt">{{ publishedAt(post.publishedAt) }}</time>
          <span>조회 {{ post.viewCount.toLocaleString('ko-KR') }}</span>
        </div>
      </header>

      <div class="article-body">
        <template v-for="(block, index) in post.blocks" :key="index">
          <p v-if="block.type === 'TEXT'">{{ block.text }}</p>
          <figure v-else class="post-image">
            <img
              :src="block.image.url"
              :alt="block.image.alt"
              :width="block.image.width"
              :height="block.image.height"
            >
          </figure>
        </template>
      </div>

      <section v-if="post.source" class="source-row" aria-label="출처">
        <strong>출처</strong>
        <a :href="post.source.url" target="_blank" rel="noopener noreferrer">
          {{ post.source.name }} <span aria-hidden="true">↗</span>
        </a>
      </section>

      <RelatedPostList
        :board-slug="post.board.slug"
        :post-id="post.postId"
        :initial-context="response.data.context"
      />
      </article>
    </main>
  </template>
  <template v-else>
    <SiteHeader detail-title="볼 수 없는 게시글입니다" :board-path="`/${boardSlug}`" />
    <main class="site-shell">
      <section class="state-panel">
        <h1>볼 수 없는 게시글입니다</h1>
        <p>존재하지 않거나 현재 공개되지 않은 게시글입니다.</p>
        <NuxtLink class="state-action" :to="`/${boardSlug}`">목록으로</NuxtLink>
      </section>
    </main>
  </template>
  <SiteFooter />
</template>
