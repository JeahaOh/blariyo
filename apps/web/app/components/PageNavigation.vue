<script setup lang="ts">
const props = defineProps<{
  currentPage: number
  totalPages: number
  path: string
}>()

const pages = computed(() => {
  if (props.totalPages <= 0) return []
  const start = Math.max(1, Math.min(props.currentPage - 2, props.totalPages - 4))
  const end = Math.min(props.totalPages, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

function target(page: number) {
  return page === 1 ? props.path : `${props.path}?page=${page}`
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="페이지 이동">
    <span v-if="currentPage <= 1" class="page-link is-disabled" aria-hidden="true">‹</span>
    <NuxtLink v-else class="page-link" :to="target(currentPage - 1)" aria-label="이전 페이지">‹</NuxtLink>
    <NuxtLink
      v-for="page in pages"
      :key="page"
      class="page-link"
      :class="{ 'is-active': page === currentPage }"
      :aria-current="page === currentPage ? 'page' : undefined"
      :to="target(page)"
    >
      {{ page }}
    </NuxtLink>
    <span v-if="currentPage >= totalPages" class="page-link is-disabled" aria-hidden="true">›</span>
    <NuxtLink v-else class="page-link" :to="target(currentPage + 1)" aria-label="다음 페이지">›</NuxtLink>
  </nav>
</template>
