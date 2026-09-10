import type {
  operations as CoreOperations,
  components as CoreComponents,
} from '@blariyo/contracts/api';
import type { operations as CollectionOperations } from '@blariyo/contracts/collection-api';
type Operations = CoreOperations & CollectionOperations;
type JsonContent<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;
// BFF validates and projects every JSON response through the canonical OpenAPI before returning it.
export type ApiResponse<K extends keyof Operations> = K extends keyof Operations
  ? Extract<
      JsonContent<Operations[K]['responses'][keyof Operations[K]['responses']]>,
      { success: true }
    >
  : never;
export type PostListItem = CoreComponents['schemas']['PostListItem'];
export type EditorState = Pick<
  CoreComponents['schemas']['AdminPostEditorData'],
  'boardSlug' | 'title' | 'source' | 'pinnedPosition'
> &
  Partial<
    Omit<
      CoreComponents['schemas']['AdminPostEditorData'],
      'boardSlug' | 'title' | 'source' | 'pinnedPosition' | 'blocks'
    >
  > & {
    blocks: (CoreComponents['schemas']['AdminBlock'] & { attached?: boolean })[];
  };
export function apiError(error: unknown): { code?: string; fields?: unknown } {
  if (typeof error !== 'object' || error === null || !('data' in error)) return {};
  const data: unknown = error.data;
  if (typeof data !== 'object' || data === null || !('error' in data)) return {};
  const value: unknown = data.error;
  if (typeof value !== 'object' || value === null) return {};
  return {
    ...('code' in value && typeof value.code === 'string' ? { code: value.code } : {}),
    ...('fields' in value ? { fields: value.fields } : {}),
  };
}
