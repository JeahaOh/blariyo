<template>
  <div class="list-skeleton" role="status" aria-label="목록을 불러오는 중입니다">
    <span class="visually-hidden">목록을 불러오는 중입니다</span>
    <div v-for="n in 6" :key="n" class="skeleton-row" aria-hidden="true">
      <span class="skeleton-title" /><span class="skeleton-meta" />
    </div>
  </div>
</template>
