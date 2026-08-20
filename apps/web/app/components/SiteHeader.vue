<script setup lang="ts">
defineProps<{
  detailTitle?: string
  boardPath?: string
}>()
</script>

<template>
  <header class="site-header">
    <div class="site-header-main">
      <NuxtLink
        v-if="detailTitle"
        class="header-action header-back"
        :to="boardPath || '/meme'"
        aria-label="목록으로"
      >
        <span aria-hidden="true">←</span>
      </NuxtLink>
      <span v-else class="header-spacer" aria-hidden="true" />

      <strong v-if="detailTitle" class="detail-header-title">{{ detailTitle }}</strong>
      <NuxtLink v-else class="brand" to="/meme" aria-label="블라리요 짤 목록">
        <span class="brand-mark" aria-hidden="true">B</span><span>블라리요</span>
      </NuxtLink>

      <div class="header-end">
        <slot name="action" />
      </div>
    </div>
    <nav v-if="!detailTitle" class="board-tabs" aria-label="게시판">
      <NuxtLink to="/meme" aria-current="page">짤</NuxtLink>
    </nav>
  </header>
</template>
