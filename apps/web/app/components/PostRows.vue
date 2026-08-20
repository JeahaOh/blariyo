<script setup lang="ts">
import type { PostListItem } from '~/types/publicContent'

defineProps<{
  pinnedItems?: PostListItem[]
  items: PostListItem[]
}>()

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

function viewCount(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}
</script>

<template>
  <div class="post-list">
    <NuxtLink
      v-for="item in pinnedItems || []"
      :key="`pin-${item.postId}`"
      class="post-row notice-row"
      :to="item.path"
    >
      <span class="notice-line">
        <span class="notice-badge">공지</span>
        <span class="post-title">{{ item.title }}</span>
      </span>
      <span class="post-meta">
        <span class="operator">{{ item.authorLabel }}</span>
        <time :datetime="item.publishedAt">{{ publishedAt(item.publishedAt) }}</time>
        <span>조회 {{ viewCount(item.viewCount) }}</span>
      </span>
    </NuxtLink>

    <template v-for="item in items" :key="item.postId">
      <div v-if="item.current" class="post-row is-current" aria-current="true">
        <span class="post-title">
          {{ item.title }} <span class="current-badge">현재 글</span>
        </span>
        <span class="post-meta">
          <span>No.{{ item.postId }}</span>
          <span class="operator">{{ item.authorLabel }}</span>
          <time :datetime="item.publishedAt">{{ publishedAt(item.publishedAt) }}</time>
          <span>조회 {{ viewCount(item.viewCount) }}</span>
        </span>
      </div>
      <NuxtLink v-else class="post-row" :to="item.path">
        <span class="post-title">{{ item.title }}</span>
        <span class="post-meta">
          <span>No.{{ item.postId }}</span>
          <span class="operator">{{ item.authorLabel }}</span>
          <time :datetime="item.publishedAt">{{ publishedAt(item.publishedAt) }}</time>
          <span>조회 {{ viewCount(item.viewCount) }}</span>
        </span>
      </NuxtLink>
    </template>
  </div>
</template>
