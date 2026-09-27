<script setup lang="ts">
const { enabled, consent, storageError, refresh, save, retry } = useConsent();
const analytics = ref(false);
defineEmits(['saved']);
function retryChoice() {
  retry();
  analytics.value = consent.value?.analytics === true;
}
onMounted(() => {
  refresh();
  analytics.value = consent.value?.analytics === true;
});
</script>
<template>
  <section>
    <h1>쿠키 설정</h1>
    <p v-if="!enabled">현재 활성화된 저장소가 없습니다</p>
    <template v-else
      ><p>선택은 이 브라우저에 12개월 동안 저장됩니다. 거부해도 콘텐츠를 이용할 수 있습니다.</p>
      <label><input type="checkbox" v-model="analytics" /> 이용 통계 분석 허용</label
      ><button @click="save(analytics) && $emit('saved')">선택 저장</button></template
    >
    <p role="status">{{ storageError }}</p>
    <button v-if="storageError" @click="retryChoice">다시 시도</button>
  </section>
</template>
