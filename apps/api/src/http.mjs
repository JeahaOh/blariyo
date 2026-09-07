import { randomUUID } from 'node:crypto';
export class ApiError extends Error {
  constructor(status, code, fields) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export const fail = (status, code, fields) => {
  throw new ApiError(status, code, fields);
};
export function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.set({ 'X-Request-Id': req.requestId, 'Cache-Control': 'no-store' });
  next();
}
export function success(req, res, data, meta = {}, status = 200, cache = 'no-store') {
  const body = { success: true, data, meta: { requestId: req.requestId, ...meta } };
  res.set('Cache-Control', cache);
  res.status(status).json(body);
}
export function errorHandler(error, req, res, _next) {
  let status = 500,
    code = 'INTERNAL_ERROR';
  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_TOO_LARGE';
  } else if (error.type === 'entity.parse.failed' || error.code?.startsWith('23')) {
    status = 400;
    code = 'VALIDATION_FAILED';
  } else if (
    /^(08|53|57P|ECONN|ETIMEDOUT|ENOTFOUND)/.test(error.code || '') ||
    /connection.*(terminated|closed)/i.test(error.message || '')
  ) {
    status = 503;
    code = 'DEPENDENCY_UNAVAILABLE';
  }
  if (code === 'IDEMPOTENCY_IN_PROGRESS') res.set('Retry-After', '1');
  res
    .status(error.type === 'entity.too.large' ? 413 : status)
    .set('Cache-Control', 'no-store')
    .json({
      success: false,
      error: {
        code,
        message: code.endsWith('NOT_FOUND')
          ? '요청한 내용을 찾을 수 없습니다.'
          : '요청을 처리하지 못했습니다. 다시 확인해 주세요.',
        ...(error.fields ? { fields: error.fields } : {}),
      },
      meta: { requestId: req.requestId || randomUUID() },
    });
}
export const id = (value) =>
  typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value));
export const slug = (value) =>
  typeof value === 'string' && value.length <= 32 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const pagination = (page, total, pageSize = 20) => ({
  page,
  pageSize,
  totalItems: total,
  totalPages: Math.ceil(total / pageSize),
  hasPrevious: page > 1,
  hasNext: page * pageSize < total,
});
