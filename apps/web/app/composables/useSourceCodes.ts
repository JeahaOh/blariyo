import type { ApiResponse } from '~~/shared/api-types';
export async function useSourceCodes() {
  const requestFetch = useRequestFetch();
  const result = await useAsyncData('source-codes', () =>
    requestFetch<ApiResponse<'listCommonCodes'>>('/api/v1/admin/common-code-groups/source/codes')
  );
  const codes = computed(() => (result.data.value?.data.items ?? []).map(item => ({ ...item, sourceKey: item.referenceKey ?? item.code })));
  const sourceName = (key: string) => codes.value.find((item) => item.sourceKey === key)?.displayName ?? key;
  return { ...result, codes, sourceName };
}
