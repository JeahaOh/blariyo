<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
definePageMeta({ path: '/admin/batch' });
const requestFetch = useRequestFetch();
const { data: listing, error } = await useAsyncData('batch-review-list', () =>
  requestFetch<ApiResponse<'listBatchItems'>>('/api/v1/admin/collect/batch-items')
);
if (error.value) throw createError({ statusCode: error.value.statusCode || 503, message: '수집 결과를 불러올 수 없습니다.' });
const page = ref(1), source = ref(''), busy = ref(false), message = ref(''), title = ref('');
const selected = ref<ApiResponse<'getBatchItem'>['data']['item'] | null>(null);
const pending = ref<{ signature: string; key: string } | null>(null);
const collectionLabels: Record<string,string> = {DISCOVERED:'수집 대기',FETCHING:'수집 중',FETCHED:'수집 완료',FAILED:'수집 실패',BLOCKED:'접근 제한',SKIPPED_DUPLICATE:'중복 제외',SKIPPED_POLICY:'기간 조건 제외'};
const labels: Record<string,string> = {UNREVIEWED:'검수 전',REVIEWING:'검수 중',APPROVED:'승인',REJECTED:'반려'};
async function refresh(n = page.value) {
  page.value = n;
  listing.value = await $fetch<ApiResponse<'listBatchItems'>>('/api/v1/admin/collect/batch-items', { query: {page:n,...(source.value?{source:source.value}:{})} });
}
async function open(id:string) {
  if (busy.value) return;
  busy.value=true;message.value='';
  try { selected.value=(await $fetch<ApiResponse<'getBatchItem'>>(`/api/v1/admin/collect/batch-items/${id}`)).data.item;title.value=selected.value.title||'';pending.value=null; }
  catch { message.value='상세를 불러오지 못했습니다. 수집 결과와 본문 형식을 확인해 주세요.'; }
  finally {busy.value=false;}
}
async function decide(decision:'REVIEWING'|'APPROVED'|'REJECTED'|'DRAFT') {
  const item=selected.value;if (!item||busy.value) return;
  const path=`/api/v1/admin/collect/batch-items/${item.itemId}/${decision==='DRAFT'?'draft':'review'}`;
  const body={itemVersion:item.version,lockVersion:item.review.lockVersion,...(decision==='DRAFT'?{boardSlug:'meme',title:title.value}:{decision})};
  const signature=JSON.stringify({path,body});
  if(pending.value?.signature!==signature)pending.value={signature,key:crypto.randomUUID()};
  busy.value=true;message.value='';
  try {
    if(decision==='DRAFT'){
      const result=await $fetch<ApiResponse<'promoteBatchItem'>>(path,{method:'POST',body,headers:{'Idempotency-Key':pending.value.key},retry:0});
      message.value=`초안 ${result.data.postId}번을 만들었습니다. 게시글 관리에서 확인 후 별도로 발행하세요.`;
    }else{
      await $fetch(path,{method:'POST',body,headers:{'Idempotency-Key':pending.value.key},retry:0});
      message.value='검수 상태를 저장했습니다.';
    }
    pending.value=null;
    selected.value=(await $fetch<ApiResponse<'getBatchItem'>>(`/api/v1/admin/collect/batch-items/${item.itemId}`)).data.item;
    await refresh();
  }catch(error){
    const code=apiError(error).code;
    message.value=code==='BATCH_DUPLICATE_POST'?'이미 같은 원문의 게시글이 있습니다.':code==='BATCH_ITEM_VERSION_CONFLICT'||code==='BATCH_REVIEW_VERSION_CONFLICT'
      ?'수집 내용 또는 검수 상태가 바뀌었습니다. 상세를 다시 열고 검수해 주세요.':'처리하지 못했습니다. 상태를 확인한 뒤 재시도해 주세요.';
  }finally{busy.value=false;}
}
</script>
<template>
  <main class="batch-admin">
    <h1>수집 결과 검수</h1>
    <p>원문과 첨부를 확인한 뒤 승인하세요. 초안을 만들어도 자동으로 발행되지 않습니다.</p>
    <NuxtLink to="/admin">게시글 관리</NuxtLink>
    <form @submit.prevent="refresh(1)"><label>출처 <input v-model="source" placeholder="예: theqoo" /></label><button :disabled="busy">조회</button></form>
    <p role="status">{{ message }}</p>
    <ul class="batch-list"><li v-for="item in listing?.data.items" :key="item.itemId">
      <button type="button" :disabled="busy" @click="open(item.itemId)">{{ item.title || '제목 없음' }}</button>
      <span>{{ item.sourceKey }} · {{ collectionLabels[item.state] || item.state }} · {{ labels[item.review.status] }}{{ item.review.postId ? ` · 초안/게시글 ${item.review.postId}` : '' }}</span>
    </li></ul>
    <nav aria-label="수집 결과 페이지"><button :disabled="busy||page<=1" @click="refresh(page-1)">이전</button><span>{{ page }} / {{ listing?.data.totalPages }}</span><button :disabled="busy||page>=(listing?.data.totalPages||1)" @click="refresh(page+1)">다음</button></nav>
    <section v-if="selected" class="batch-detail" aria-label="수집 결과 상세">
      <h2>{{ selected.title || '제목을 가져오지 못한 글' }}</h2>
      <a :href="selected.canonicalUrl" target="_blank" rel="noopener noreferrer">원문 확인 ↗</a>
      <p>{{ collectionLabels[selected.state] || selected.state }} · {{ labels[selected.review.status] }}</p>
      <p v-if="selected.failureCode" role="status">수집하지 못했습니다. 원문 상태를 확인해 주세요. ({{ selected.failureCode }})</p>
      <p v-if="selected.skipReason==='SOURCE_DATE_UNKNOWN'">작성 시각을 확인할 수 없어 기간 조건에 따라 제외했습니다.</p>
      <p v-else-if="selected.skipReason==='SOURCE_OUTSIDE_WINDOW'">설정한 수집 기간에 포함되지 않아 제외했습니다.</p>
      <div class="actions"><button :disabled="busy||selected.state!=='FETCHED'||!!selected.review.postId" @click="decide('REVIEWING')">검수 시작 / 다시 검수</button>
        <button :disabled="busy||selected.review.status!=='REVIEWING'" @click="decide('REJECTED')">반려</button>
        <button :disabled="busy||selected.review.status!=='REVIEWING'" @click="decide('APPROVED')">승인</button></div>
      <label>초안 제목 <input v-model="title" maxlength="200" /></label>
      <button :disabled="busy||selected.review.status!=='APPROVED'||!!selected.review.postId||!title.trim()" @click="decide('DRAFT')">게시글 초안 만들기</button>
      <p v-if="selected.review.postId">연결된 게시글: {{ selected.review.postId }} · <NuxtLink to="/admin">게시글 관리에서 열기</NuxtLink></p>
      <div class="original-body"><template v-for="(block,index) in selected.bodyBlocks" :key="index">
        <p v-if="block.type==='TEXT'">{{ block.text }}</p>
        <CollectImagePreview v-else-if="block.type==='IMAGE'" :src="`/api/v1/admin/collect/batch-items/${selected.itemId}/media/${block.imagePosition}/preview`" :alt="block.alt||`수집 이미지 ${block.imagePosition}`" :source-url="selected.canonicalUrl" />
        <p v-else><a :href="block.url" target="_blank" rel="noopener noreferrer">{{ block.label||block.url }}</a></p>
      </template></div>
      <h3 v-if="selected.attachments.length">첨부 원문 링크</h3><ul><li v-for="attachment in selected.attachments" :key="attachment.position"><a :href="attachment.remoteUrl" target="_blank" rel="noopener noreferrer">{{ attachment.label||attachment.remoteUrl }}</a></li></ul>
    </section>
  </main>
</template>
<style scoped>
.batch-admin{max-width:960px;margin:0 auto;padding:24px}.batch-admin form,.actions,nav{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}.batch-list{padding:0;list-style:none}.batch-list li{display:grid;gap:6px;border-bottom:1px solid #ddd;padding:12px 0}.batch-list button{text-align:left}.batch-list span{font-size:.85rem;color:#666}.batch-detail{margin-top:32px;border-top:2px solid #ddd;padding-top:20px}.batch-detail label{display:block;margin:16px 0}.batch-detail input{width:100%;max-width:700px}.original-body{margin-top:24px}.original-body p{white-space:pre-wrap;overflow-wrap:anywhere}.original-body img{display:block;max-width:100%;height:auto;margin:16px 0}button,input{padding:8px 12px}button:disabled{opacity:.5}
</style>
