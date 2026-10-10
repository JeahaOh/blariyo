<script setup lang="ts">
defineProps<{ count: number; busy: boolean; blocked: boolean }>();
defineEmits<{ confirm: []; cancel: [] }>();
const confirmation = ref<HTMLElement>();
onMounted(() => confirmation.value?.focus());
</script>
<template>
  <div ref="confirmation" class="keyword-delete-confirm" role="alert" tabindex="-1">
    <p>{{ count }}개 키워드를 삭제할까요? 해당 행의 미저장 수정도 사라집니다.</p>
    <button class="keyword-delete" :disabled="blocked" @click="$emit('confirm')">
      {{ count }}개 삭제 확인
    </button>
    <button :disabled="busy" @click="$emit('cancel')">취소</button>
  </div>
</template>
