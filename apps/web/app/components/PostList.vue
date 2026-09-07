<script setup>
const { $analytics } = useNuxtApp();
defineProps({
  items: { type: Array, default: () => [] },
  pinnedItems: { type: Array, default: () => [] },
});
const date = (value) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
</script>
<template>
  <div class="post-list">
    <p v-if="!items.length && !pinnedItems.length" class="empty">아직 게시글이 없습니다.</p>
    <NuxtLink
      v-for="item in [...pinnedItems, ...items]"
      :key="item.postId"
      :to="item.path"
      class="post-row"
      @click="
        $analytics?.send('select_content', {
          board_slug: item.path.split('/')[1],
          content_type: 'post',
          list_position_bucket: pinnedItems.includes(item)
            ? 'pinned'
            : items.indexOf(item) < 5
              ? '1-5'
              : items.indexOf(item) < 10
                ? '6-10'
                : items.indexOf(item) < 15
                  ? '11-15'
                  : '16-20',
        })
      "
      :class="{ current: item.current }"
      :aria-current="item.current ? 'page' : undefined"
    >
      <span class="post-number">{{ pinnedItems.includes(item) ? '공지' : item.postId }}</span
      ><strong>{{ item.title }}</strong>
      <span class="post-meta"
        >조회 {{ item.viewCount }} · {{ item.authorLabel }} · {{ date(item.publishedAt) }}</span
      >
    </NuxtLink>
  </div>
</template>
