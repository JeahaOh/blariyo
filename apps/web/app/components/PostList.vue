<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import type { PostListItem } from '~~/shared/api-types';
import { NuxtLink } from '#components';
const { $analytics } = useNuxtApp();
const props = withDefaults(
  defineProps<{
    items?: PostListItem[];
    pinnedItems?: PostListItem[];
    listArea?: 'main' | 'detail_footer';
    listPage?: number;
  }>(),
  {
    items: () => [],
    pinnedItems: () => [],
    listArea: 'main',
    listPage: 1,
  }
);
const emit = defineEmits<{ (event: 'instance-change', key: string): void }>();
const items = computed(() => props.items);
const pinnedItems = computed(() => props.pinnedItems);
const makeKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
const listInstanceKey = ref(makeKey());
const rows = new Map<number, Element>();
const impressionTimers = new Map<number, ReturnType<typeof setTimeout>>();
const impressionKeys = new Map<string, string>();
const observedImpressions = new Set<string>();
let observer: IntersectionObserver | undefined;
const allItems = computed(() => [...props.pinnedItems, ...props.items]);
const boardSlug = (item: PostListItem) => item.path.split('/')[1] || 'meme';
const itemMeta = (item: PostListItem) => {
  const pinned = props.pinnedItems.includes(item);
  return {
    board_slug: boardSlug(item),
    list_instance_key: listInstanceKey.value,
    list_area: props.listArea,
    list_kind: pinned ? 'pinned' : 'regular',
    list_page: props.listPage,
    list_position: pinned ? props.pinnedItems.indexOf(item) + 1 : props.items.indexOf(item) + 1,
    content_key: item.analyticsContentKey,
    content_type: 'post',
  };
};
const setRowRef = (postId: number, element: Element | ComponentPublicInstance | null) => {
  if (element instanceof Element) rows.set(postId, element);
  else rows.delete(postId);
};
const rowRef = (postId: number) => (element: Element | ComponentPublicInstance | null) =>
  setRowRef(postId, element);
function trackSelect(item: PostListItem, event: MouseEvent) {
  if (item.current) return;
  const link = event.currentTarget instanceof HTMLAnchorElement ? event.currentTarget : null;
  const newContext =
    event.button === 1 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link?.target === '_blank';
  const impressionKey = impressionKeys.get(item.analyticsContentKey || '');
  $analytics?.send('select_content', {
    ...itemMeta(item),
    exposure_state: impressionKey ? 'qualified' : 'unqualified',
    ...(impressionKey ? { impression_key: impressionKey } : {}),
    open_mode: newContext ? 'new_context' : event.button === 0 ? 'same_tab' : 'unknown',
  });
}
function stopImpressionTimer(postId: number) {
  const timer = impressionTimers.get(postId);
  if (timer) clearTimeout(timer);
  impressionTimers.delete(postId);
}
function observeRows() {
  observer?.disconnect();
  impressionTimers.forEach((timer) => clearTimeout(timer));
  impressionTimers.clear();
  if (
    !import.meta.client ||
    document.visibilityState !== 'visible' ||
    !('IntersectionObserver' in window)
  )
    return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;
        const postId = Number(entry.target.dataset.postId);
        const item = allItems.value.find((value) => value.postId === postId);
        if (!item || item.current) continue;
        const key = `${listInstanceKey.value}:${item.analyticsContentKey}`;
        if (observedImpressions.has(key)) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!impressionTimers.has(postId))
            impressionTimers.set(
              postId,
              setTimeout(() => {
                impressionTimers.delete(postId);
                const impressionKey = makeKey();
                if (
                  $analytics?.send('list_impression', {
                    ...itemMeta(item),
                    impression_key: impressionKey,
                  })
                ) {
                  observedImpressions.add(key);
                  impressionKeys.set(item.analyticsContentKey || '', impressionKey);
                }
              }, 1000)
            );
        } else stopImpressionTimer(postId);
      }
    },
    { threshold: [0, 0.5, 1] }
  );
  for (const item of allItems.value) {
    const row = rows.get(item.postId);
    if (row && !item.current) observer.observe(row);
  }
}
onMounted(() => nextTick(observeRows));
watch(
  () => [props.listPage, props.items, props.pinnedItems],
  () => {
    listInstanceKey.value = makeKey();
    impressionKeys.clear();
    observedImpressions.clear();
    emit('instance-change', listInstanceKey.value);
    void nextTick(observeRows);
  }
);
onMounted(() => {
  emit('instance-change', listInstanceKey.value);
  document.addEventListener('visibilitychange', observeRows);
  window.addEventListener('blariyo-analytics-ready', observeRows);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  impressionTimers.forEach((timer) => clearTimeout(timer));
  document.removeEventListener('visibilitychange', observeRows);
  window.removeEventListener('blariyo-analytics-ready', observeRows);
});
watch(allItems, () => nextTick(observeRows), { deep: true });
const date = (value: string) =>
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
    <p v-if="!items.length && !pinnedItems.length" class="empty">아직 올라온 짤이 없습니다</p>
    <component
      :is="item.current ? 'div' : NuxtLink"
      v-for="item in [...pinnedItems, ...items]"
      :key="item.postId"
      :ref="rowRef(item.postId)"
      :data-post-id="item.postId"
      :to="item.current ? undefined : item.path"
      class="post-row"
      @click="trackSelect(item, $event)"
      @auxclick="trackSelect(item, $event)"
      :class="{ current: item.current, pinned: pinnedItems.includes(item) }"
      :aria-current="item.current ? 'true' : undefined"
    >
      <span class="post-title-line">
        <span v-if="pinnedItems.includes(item)" class="notice-badge">공지</span>
        <strong class="post-title">{{ item.title }}</strong>
        <span v-if="item.current" class="current-badge">현재 글</span>
      </span>
      <span class="post-meta">
        <span v-if="!pinnedItems.includes(item)" class="post-number">{{ item.postId }}</span>
        <span>조회 {{ item.viewCount }}</span
        ><span class="operator">{{ item.authorLabel }}</span>
        <time :datetime="item.publishedAt">{{ date(item.publishedAt) }}</time>
      </span>
    </component>
  </div>
</template>
