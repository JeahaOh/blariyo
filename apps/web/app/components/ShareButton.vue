<script setup lang="ts">
const props = defineProps<{ title: string; url: string }>()
const status = ref('')

async function share() {
  try {
    if (navigator.share) {
      await navigator.share({ title: props.title, url: props.url })
      status.value = '공유했습니다.'
      return
    }
    await navigator.clipboard.writeText(props.url)
    status.value = '링크를 복사했습니다.'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    status.value = '공유하지 못했습니다.'
  }
}
</script>

<template>
  <button type="button" class="header-action share-action" aria-label="공유하기" @click="share">
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </svg>
  </button>
  <span class="sr-only" aria-live="polite">{{ status }}</span>
</template>
