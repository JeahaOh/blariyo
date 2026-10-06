<script setup lang="ts">
import { apiError, type ApiResponse } from '~~/shared/api-types';
definePageMeta({ path: '/admin/common-codes' });
type Code = ApiResponse<'listCommonCodes'>['data']['items'][number];
type Group = ApiResponse<'listCommonCodeGroups'>['data']['items'][number];
const requestFetch = useRequestFetch();
const { data: groups, error: groupError, refresh: refreshGroups } = await useAsyncData('common-code-groups', () =>
  requestFetch<ApiResponse<'listCommonCodeGroups'>>('/api/v1/admin/common-code-groups')
);
const selectedGroup = ref('source');
const { data: listing, error: listError } = await useAsyncData('common-code-editor-items', () =>
  requestFetch<ApiResponse<'listCommonCodes'>>('/api/v1/admin/common-code-groups/source/codes')
);
const reloading = ref(false);
const busy = ref(false), feedback = ref(''), failure = ref('');
const code = ref(''), displayName = ref(''), referenceKey = ref('');
const editing = ref<Code | null>(null);
const groupDraft = ref<{ groupKey: string; displayName: string; lockVersion?: number } | null>(null);
const canManage = computed(() => groups.value?.data.canManage === true);
const currentGroup = computed(() => groups.value?.data.items.find(item => item.groupKey === selectedGroup.value));
const codes = computed(() => listing.value?.data.items ?? []);
const sourceGroup = computed(() => selectedGroup.value === 'source');
function begin(item: Code) { editing.value = { ...item }; failure.value = ''; feedback.value = ''; }
function editGroup(group: Group) { groupDraft.value = { groupKey: group.groupKey, displayName: group.displayName, lockVersion: group.lockVersion }; }
function resetCodeForm() { editing.value = null; code.value = ''; displayName.value = ''; referenceKey.value = ''; }
function describeError(error: unknown) {
  const code = apiError(error).code;
  return code === 'COMMON_CODE_EXISTS' || code === 'COMMON_CODE_GROUP_EXISTS' ? '이미 등록된 코드 또는 수집 연결입니다. 최신 목록에서 확인해 주세요.'
    : code === 'COMMON_CODE_VERSION_CONFLICT' ? '다른 변경이 먼저 저장됐습니다. 최신 목록을 다시 조회한 뒤 수정할 항목을 다시 선택해 주세요. 입력은 유지했습니다.'
    : code === 'VALIDATION_FAILED' ? '입력 형식을 확인해 주세요. source 코드는 소문자로 시작하는 영문 소문자·숫자 4자리이며 수집 연결 식별자가 필요합니다.'
    : code === 'ADMIN_FORBIDDEN' || code === 'ADMIN_AUTH_REQUIRED' ? '관리자 인증 또는 수정 권한을 확인해 주세요. 입력은 유지했습니다.'
    : '저장 결과를 확인하지 못했습니다. 최신 목록을 다시 조회해 반영 여부를 확인해 주세요. 입력은 유지했습니다.';
}
async function loadCodes() {
  listing.value = await $fetch<ApiResponse<'listCommonCodes'>>(`/api/v1/admin/common-code-groups/${selectedGroup.value}/codes`, { retry: 0 });
  listError.value = undefined;
}
async function changeGroup() {
  if (busy.value) return;
  busy.value = true; resetCodeForm(); groupDraft.value = null; listing.value = undefined; feedback.value = ''; failure.value = '';
  try { await loadCodes(); } catch { failure.value = '선택한 그룹의 코드를 불러오지 못했습니다. 다시 조회해 주세요.'; }
  finally { busy.value = false; }
}
async function reload() {
  if (busy.value) return;
  busy.value = true; reloading.value = true;
  try { await refreshGroups(); await loadCodes(); } catch { failure.value = '목록을 불러오지 못했습니다. 다시 조회해 주세요.'; }
  finally { busy.value = false; reloading.value = false; }
}
async function saveGroup() {
  const draft = groupDraft.value;
  if (!draft || busy.value || !canManage.value) return;
  busy.value = true; failure.value = ''; feedback.value = '';
  try {
    const response = draft.lockVersion
      ? await $fetch<ApiResponse<'updateCommonCodeGroup'>>(`/api/v1/admin/common-code-groups/${draft.groupKey}`, {
          method: 'PATCH', body: { displayName: draft.displayName.trim(), lockVersion: draft.lockVersion }, retry: 0,
        })
      : await $fetch<ApiResponse<'createCommonCodeGroup'>>('/api/v1/admin/common-code-groups', {
          method: 'POST', body: { groupKey: draft.groupKey.trim(), displayName: draft.displayName.trim() }, retry: 0,
        });
    if (groups.value) groups.value = { ...groups.value, data: { ...groups.value.data,
      items: [...groups.value.data.items.filter(item => item.groupKey !== response.data.groupKey), response.data].sort((a,b) => a.groupKey.localeCompare(b.groupKey)),
    } };
    groupDraft.value = null; feedback.value = '그룹을 저장했습니다.';
  } catch (error) { failure.value = describeError(error); }
  finally { busy.value = false; }
}
async function saveCode() {
  if (busy.value || !canManage.value || !currentGroup.value) return;
  busy.value = true; failure.value = ''; feedback.value = '';
  const previous = editing.value;
  try {
    const base = `/api/v1/admin/common-code-groups/${selectedGroup.value}/codes`;
    const response = previous
      ? await $fetch<ApiResponse<'updateCommonCode'>>(`${base}/${previous.code}`, {
          method: 'PATCH', body: { displayName: previous.displayName.trim(), lockVersion: previous.lockVersion }, retry: 0,
        })
      : await $fetch<ApiResponse<'createCommonCode'>>(base, {
          method: 'POST', body: { code: code.value.trim(), displayName: displayName.value.trim(), referenceKey: sourceGroup.value ? referenceKey.value.trim() : null }, retry: 0,
        });
    if (listing.value) listing.value = { ...listing.value, data: { ...listing.value.data,
      items: [...codes.value.filter(item => item.code !== response.data.code), response.data].sort((a,b) => a.code.localeCompare(b.code)),
    } };
    resetCodeForm(); feedback.value = previous ? '코드명을 수정했습니다.' : '코드를 등록했습니다.';
    if (sourceGroup.value) await refreshNuxtData('source-codes');
  } catch (error) { failure.value = describeError(error); }
  finally { busy.value = false; }
}
useUiLoading(() => busy.value);
</script>
<template>
  <main class="common-codes">
    <header><h1>공통코드 관리</h1><p>그룹별 코드와 표시 이름을 관리합니다.</p></header>
    <div class="group-toolbar">
      <label><span id="common-code-group-label">코드 그룹</span> <select aria-labelledby="common-code-group-label" v-model="selectedGroup" :disabled="busy" @change="changeGroup">
        <option v-for="group in groups?.data.items" :key="group.groupKey" :value="group.groupKey">{{ group.displayName }} ({{ group.groupKey }})</option>
      </select></label>
      <button v-if="canManage" :disabled="busy" @click="groupDraft = { groupKey: '', displayName: '' }">그룹 추가</button>
      <button v-if="canManage && currentGroup" :disabled="busy" @click="editGroup(currentGroup)">그룹명 수정</button>
    </div>
    <form v-if="canManage && groupDraft" @submit.prevent="saveGroup">
      <h2>{{ groupDraft.lockVersion ? '그룹명 수정' : '그룹 추가' }}</h2>
      <label>그룹 키 <input v-model="groupDraft.groupKey" :readonly="!!groupDraft.lockVersion" :disabled="busy" required pattern="[a-z][a-z0-9_\-]{0,39}" maxlength="40" placeholder="예: source" /></label>
      <label>그룹명 <input v-model="groupDraft.displayName" :disabled="busy" required maxlength="200" placeholder="예: 출처" /></label>
      <button :disabled="busy">그룹 저장</button><button type="button" :disabled="busy" @click="groupDraft = null">그룹 편집 취소</button>
    </form>
    <p v-if="sourceGroup">출처는 영문 소문자·숫자 4자리 코드로 관리합니다. 예: thqo · 더쿠. 수집 연결 식별자는 기존 수집 결과와 연결하며, 등록만으로 스크래핑이 활성화되지는 않습니다.</p>
    <p>기존 데이터 연결을 유지하기 위해 등록한 그룹 키·코드·수집 연결은 고정됩니다. 이름은 수정할 수 있습니다.</p>
    <p v-if="groups && !canManage">그룹과 코드 추가·수정은 OWNER 권한으로 사용할 수 있습니다.</p>
    <form v-if="canManage && currentGroup" @submit.prevent="saveCode">
      <h2>{{ editing ? '코드명 수정' : '코드 추가' }}</h2>
      <label v-if="editing">코드 <input :value="editing.code" readonly /></label>
      <label v-else>코드 <input v-model="code" :disabled="busy" required :pattern="sourceGroup ? '[a-z][a-z0-9]{3}' : '[a-z0-9][a-z0-9_\\-]{0,39}'" :maxlength="sourceGroup ? 4 : 40" :placeholder="sourceGroup ? '예: thqo' : '코드 입력'" /></label>
      <label v-if="editing">코드명 <input v-model="editing.displayName" :disabled="busy" required maxlength="200" /></label>
      <label v-else>코드명 <input v-model="displayName" :disabled="busy" required maxlength="200" :placeholder="sourceGroup ? '예: 더쿠' : '표시 이름'" /></label>
      <label v-if="sourceGroup && editing">수집 연결 식별자 <input :value="editing.referenceKey ?? ''" readonly /></label>
      <label v-else-if="sourceGroup">수집 연결 식별자 <input v-model="referenceKey" :disabled="busy" required pattern="[a-z][a-z0-9\-]{0,79}" maxlength="80" placeholder="예: theqoo" /></label>
      <button :disabled="busy" type="submit">{{ editing ? '수정 저장' : '코드 등록' }}</button>
      <button v-if="editing" :disabled="busy" type="button" @click="resetCodeForm">수정 취소</button>
    </form>
    <p role="status">{{ feedback }}</p>
    <p v-if="failure || groupError || listError" role="alert">{{ failure || '공통코드 목록을 불러오지 못했습니다. 다시 조회해 주세요.' }}</p>
    <div class="list-heading"><h2>{{ currentGroup?.displayName || selectedGroup }} 코드 {{ codes.length }}개</h2><button :disabled="busy" @click="reload">{{ reloading ? '목록 조회 중…' : '최신 목록 다시 조회' }}</button></div>
    <div class="table-scroll"><table>
      <thead><tr><th scope="col">코드</th><th scope="col">코드명</th><th v-if="sourceGroup" scope="col">수집 연결</th><th v-if="canManage" scope="col">관리</th></tr></thead>
      <tbody><tr v-for="item in codes" :key="`${item.groupKey}:${item.code}`">
        <td>{{ item.code }}</td><td>{{ item.displayName }}</td><td v-if="sourceGroup">{{ item.referenceKey }}</td>
        <td v-if="canManage"><button :disabled="busy" :aria-label="`${item.displayName} 수정`" @click="begin(item)">수정</button></td>
      </tr></tbody>
    </table></div>
    <p v-if="!busy && !failure && !listError && !codes.length">등록된 코드가 없습니다.</p>
  </main>
</template>
<style scoped>
.common-codes { max-width: 1100px; }
.group-toolbar, form { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
form { border: 1px solid #d6d9dc; padding: 20px; margin-block: 16px; }
form h2 { width: 100%; margin: 0; }
label { display: flex; flex-direction: column; gap: 6px; max-width: 100%; }
input, select { min-height: 40px; max-width: 100%; }
button { min-height: 40px; }
.list-heading { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px; border-bottom: 1px solid #d6d9dc; text-align: left; }
[role='alert'] { color: #a12622; }
</style>
