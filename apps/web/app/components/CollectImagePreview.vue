<script setup lang="ts">
import { apiError } from '~~/shared/api-types';
const props = defineProps<{ src: string; alt: string; sourceUrl: string; statusPath?: string }>();
const emit = defineEmits<{ expired: [] }>();
const failed = ref(false);
let check: AbortController | undefined;
watch(() => props.src, () => { check?.abort(); failed.value = false; });
onUnmounted(() => check?.abort());
async function failure() {
  failed.value = true;
  if (!props.statusPath) return;
  check?.abort(); const current = new AbortController(); check = current;
  try { await $fetch(props.statusPath, { retry: 0, signal: current.signal }); }
  catch (error) { if (!current.signal.aborted && apiError(error).code === 'BATCH_ITEM_EXPIRED') emit('expired'); }
}
</script>
<template>
  <div v-if="failed" class="preview-failure" role="status">
    <p>{{ alt }}: 미리보기를 불러오지 못했습니다. 이미지 처리 제한, 파일 상태 또는 인증을 확인해 주세요.</p>
    <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">원문에서 확인 ↗</a>
    <button type="button" @click="failed = false">다시 불러오기</button>
  </div>
  <img v-else :src="src" :alt="alt" loading="lazy" @error="failure" />
</template>
<style scoped>
.preview-failure{border:1px solid #a65b20;padding:12px;margin:16px 0}.preview-failure button{margin-left:12px}
img{display:block;max-width:100%;height:auto;margin:16px 0}
</style>
