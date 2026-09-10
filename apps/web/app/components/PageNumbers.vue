<script setup lang="ts">
const props = defineProps<{ page: number; total: number }>();
defineEmits<{ change: [page: number] }>();
const pages = computed(() => {
  const start = Math.floor((props.page - 1) / 10) * 10 + 1;
  return Array.from(
    { length: Math.max(0, Math.min(10, props.total - start + 1)) },
    (_, i) => start + i
  );
});
</script>
<template>
  <nav aria-label="페이지 이동" class="pagination">
    <button v-if="page > 1" @click="$emit('change', page - 1)" aria-label="이전 페이지">←</button>
    <button
      v-for="n in pages"
      :key="n"
      :aria-current="n === page ? 'page' : undefined"
      @click="$emit('change', n)"
    >
      {{ n }}
    </button>
    <button v-if="page < total" @click="$emit('change', page + 1)" aria-label="다음 페이지">
      →
    </button>
  </nav>
</template>
