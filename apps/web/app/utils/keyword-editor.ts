import type { ApiResponse } from '../../shared/api-types';

export type KeywordData = ApiResponse<'listAutoPublishKeywords'>['data'];
export type Keyword = KeywordData['items'][number];
export type KeywordDraft = Omit<Keyword, 'keywordId'>;
export type KeywordRow = Keyword & { draft: KeywordDraft; message: string };
export type KeywordBulkMode = 'KEEP' | Keyword['matchMode'];

export const keywordGroups: { value: Keyword['group']; label: string }[] = [
  { value: 'LIFE', label: '생활' },
  { value: 'HUMOR', label: '유머' },
  { value: 'REACTION', label: '반응 단서' },
  { value: 'POLITICS_OR_CONFLICT', label: '제외 · 정치/갈등' },
  { value: 'NEWS_OR_ENTERTAINMENT', label: '제외 · 뉴스/연예' },
  { value: 'HEALTH_OR_FINANCE', label: '제외 · 의료/금융' },
  { value: 'PROMOTION_OR_POINTS', label: '제외 · 광고/포인트' },
  { value: 'ADULT_OR_HARM', label: '제외 · 유해 소재' },
];
export const keywordScopes: { value: Keyword['scope']; label: string }[] = [
  { value: 'TITLE', label: '제목' },
  { value: 'BODY', label: '본문' },
  { value: 'BOTH', label: '제목과 본문' },
];
export const keywordModes: { value: Keyword['matchMode']; label: string }[] = [
  { value: 'CONTAINS', label: '부분 일치' },
  { value: 'WORD', label: '단어 일치' },
];
export const keywordBulkModes = [{ value: 'KEEP', label: '일치 방식 유지' }, ...keywordModes];
export const keywordEnabledOptions = [
  { value: true, label: '사용' },
  { value: false, label: '사용 안 함' },
];
export const keywordFilterGroups = [{ value: 'all', label: '전체 분류' }, ...keywordGroups];
export const keywordFilterEnabled = [
  { value: 'all', label: '전체 상태' },
  { value: 'on', label: '사용' },
  { value: 'off', label: '사용 안 함' },
];

export function emptyKeywordDraft(): KeywordDraft {
  return { keyword: '', group: 'LIFE', scope: 'TITLE', matchMode: 'CONTAINS', enabled: true };
}
export function keywordDraftOf(item: Keyword): KeywordDraft {
  return {
    keyword: item.keyword,
    group: item.group,
    scope: item.scope,
    matchMode: item.matchMode,
    enabled: item.enabled,
  };
}
export function sameKeywordDraft(a: KeywordDraft, b: KeywordDraft) {
  return (
    a.keyword === b.keyword &&
    a.group === b.group &&
    a.scope === b.scope &&
    a.matchMode === b.matchMode &&
    a.enabled === b.enabled
  );
}
export function keywordChanged(row: KeywordRow, draft = row.draft) {
  return !sameKeywordDraft(draft, row);
}
export function keywordBulkItems(rows: KeywordRow[], mode: KeywordBulkMode): Keyword[] {
  return rows.flatMap((row) => {
    const draft = { ...row.draft, matchMode: mode === 'KEEP' ? row.draft.matchMode : mode };
    return keywordChanged(row, draft) ? [{ ...draft, keywordId: row.keywordId }] : [];
  });
}
/** Definite input rejection keeps drafts; conflicts and uncertain responses require latest target values. */
export function keywordFailure(code: string | undefined, deleting = false) {
  const preserveDraft = [
    'VALIDATION_FAILED',
    'AUTO_PUBLISH_KEYWORD_DUPLICATE',
    'AUTO_PUBLISH_KEYWORD_LIMIT',
  ].includes(code ?? '');
  const message =
    code === 'AUTO_PUBLISH_KEYWORD_VERSION_CONFLICT'
      ? '다른 관리자가 변경했습니다. 최신 값을 확인해 주세요.'
      : code === 'AUTO_PUBLISH_KEYWORD_DUPLICATE'
        ? '동일한 키워드와 조건이 이미 등록돼 있습니다. 저장하지 않았습니다.'
        : code === 'VALIDATION_FAILED'
          ? '키워드와 입력 조건을 확인해 주세요. 반영하지 않았습니다.'
          : code === 'AUTO_PUBLISH_KEYWORD_LIMIT'
            ? '키워드는 최대 500개까지 등록할 수 있습니다.'
            : code === 'AUTO_PUBLISH_KEYWORD_NOT_FOUND'
              ? '삭제되거나 변경된 키워드가 있습니다. 최신 값을 확인해 주세요.'
              : `${deleting ? '삭제' : '저장'} 결과를 확인하지 못했습니다. 최신 값을 다시 조회합니다.`;
  return { preserveDraft, message };
}
