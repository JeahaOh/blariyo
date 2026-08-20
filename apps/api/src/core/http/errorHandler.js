const AppError = require('../errors/appError');

function notFoundHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: '요청한 경로를 찾을 수 없습니다.',
      fields: [],
    },
    meta: { requestId: req.requestId },
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let appError;
  if (error instanceof AppError) {
    appError = error;
  } else if (error?.type === 'entity.parse.failed') {
    appError = new AppError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { field: 'body', reason: 'invalidJson' },
    ]);
  } else if (error?.type === 'entity.too.large') {
    appError = new AppError(413, 'REQUEST_TOO_LARGE', '요청 크기를 줄여 주세요.');
  } else {
    appError = new AppError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  }

  if (!(error instanceof AppError) && process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.setHeader('Cache-Control', 'no-store');
  if (appError.code === 'IDEMPOTENCY_IN_PROGRESS') res.setHeader('Retry-After', '1');
  return res.status(appError.status).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      fields: appError.fields,
    },
    meta: { requestId: req.requestId },
  });
}

module.exports = { errorHandler, notFoundHandler };
