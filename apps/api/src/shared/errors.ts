export interface FieldError {
  field: string;
  reason: string;
}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields?: readonly FieldError[],
    readonly retryAfterSeconds?: number
  ) {
    super(code);
  }
}
export function fail(status: number, code: string, fields?: readonly FieldError[]): never {
  throw new ApiError(status, code, fields);
}
export const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value));
export const validSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 32 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export function pagination(page: number, total: number, pageSize = 20) {
  return {
    page,
    pageSize,
    totalItems: total,
    totalPages: Math.ceil(total / pageSize),
    hasPrevious: page > 1,
    hasNext: page * pageSize < total,
  };
}
