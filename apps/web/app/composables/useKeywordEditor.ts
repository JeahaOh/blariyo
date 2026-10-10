import type { components } from '@blariyo/contracts/collection-api';
import { apiError, type ApiResponse } from '../../shared/api-types';
import {
  emptyKeywordDraft,
  keywordDraftOf,
  keywordChanged,
  keywordFailure,
  type Keyword,
  type KeywordData,
  type KeywordRow,
} from '../utils/keyword-editor';

type Mutation = {
  suffix: string;
  method: 'POST' | 'PATCH';
  body:
    | components['schemas']['SaveAutoPublishKeyword']
    | components['schemas']['BulkAutoPublishKeywords'];
  ids: string[];
  successMessage: string;
  row?: KeywordRow;
  deleting?: boolean;
};
const endpoint = '/api/v1/admin/collect/auto-publish-keywords';

export function useKeywordEditor() {
  const requestFetch = useRequestFetch();
  const rows = ref<KeywordRow[]>([]),
    version = ref(''),
    canManage = ref(false);
  const busy = ref(false),
    loadFailed = ref(false),
    loaded = ref(false),
    notice = ref('');
  const newKeyword = ref(emptyKeywordDraft());
  const blocked = computed(() => busy.value || loadFailed.value || !canManage.value);

  function install(data: KeywordData, resetIds: string[] = []) {
    version.value = data.ruleVersion;
    canManage.value = data.canManage;
    const old = new Map(rows.value.map((row) => [row.keywordId, row])),
      reset = new Set(resetIds);
    rows.value = data.items.map((item) => {
      const existing = old.get(item.keywordId);
      if (!existing) return { ...item, draft: keywordDraftOf(item), message: '' };
      const keepDraft = keywordChanged(existing) && !reset.has(item.keywordId);
      Object.assign(existing, item);
      if (!keepDraft) existing.draft = keywordDraftOf(item);
      return existing;
    });
    loaded.value = true;
    loadFailed.value = false;
  }
  async function load(resetIds: string[] = []) {
    try {
      install(
        (await requestFetch<ApiResponse<'listAutoPublishKeywords'>>(endpoint)).data,
        resetIds
      );
      return true;
    } catch {
      loadFailed.value = true;
      return false;
    }
  }
  async function reload() {
    if (busy.value) return;
    busy.value = true;
    try {
      if (await load()) {
        notice.value = '';
        for (const row of rows.value) row.message = '';
      }
    } finally {
      busy.value = false;
    }
  }
  async function mutate(input: Mutation) {
    if (blocked.value) return false;
    busy.value = true;
    notice.value = '';
    if (input.row) input.row.message = '';
    try {
      const result = await $fetch<ApiResponse<'listAutoPublishKeywords'>>(endpoint + input.suffix, {
        method: input.method,
        retry: 0,
        body: input.body,
      });
      install(result.data, input.ids);
      if (input.row) input.row.message = input.successMessage;
      else notice.value = input.successMessage;
      return true;
    } catch (error: unknown) {
      const recovery = keywordFailure(apiError(error).code, input.deleting);
      const confirmed = await load(recovery.preserveDraft ? [] : input.ids);
      if (input.row && rows.value.some((row) => row.keywordId === input.row?.keywordId))
        input.row.message = recovery.message;
      else notice.value = recovery.message;
      if (!confirmed)
        notice.value = '최신 설정을 확인하지 못했습니다. 다시 조회한 뒤 저장해 주세요.';
      return false;
    } finally {
      busy.value = false;
    }
  }
  async function save(row?: KeywordRow) {
    const saved = await mutate({
      suffix: row ? '/' + row.keywordId : '',
      method: row ? 'PATCH' : 'POST',
      body: { ...(row ? row.draft : newKeyword.value), ruleVersion: version.value },
      ids: row ? [row.keywordId] : [],
      ...(row ? { row } : {}),
      successMessage: row ? '저장했습니다.' : '키워드를 추가했습니다.',
    });
    if (saved && !row) newKeyword.value = emptyKeywordDraft();
    return saved;
  }
  function saveBulk(items: Keyword[]) {
    if (!items.length) return Promise.resolve(false);
    return mutate({
      suffix: '/bulk',
      method: 'POST',
      body: { action: 'SAVE', ruleVersion: version.value, items },
      ids: items.map((item) => item.keywordId),
      successMessage: `${items.length}개 키워드를 저장했습니다.`,
    });
  }
  function remove(ids: string[]) {
    if (!ids.length) return Promise.resolve(false);
    return mutate({
      suffix: '/bulk',
      method: 'POST',
      body: { action: 'DELETE', ruleVersion: version.value, keywordIds: [...ids] },
      ids: [...ids],
      deleting: true,
      successMessage: `${ids.length}개 키워드를 삭제했습니다.`,
    });
  }
  return {
    rows,
    version,
    canManage,
    busy,
    loadFailed,
    loaded,
    notice,
    newKeyword,
    blocked,
    load,
    reload,
    save,
    saveBulk,
    remove,
  };
}
