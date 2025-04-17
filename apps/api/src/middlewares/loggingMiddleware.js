const logger = require('../utils/logger');

const loggingMiddleware = (req, res, next) => {
  const start = Date.now();
  const { method, url, body, query, params } = req;

  // 요청 시작 로그
  logger.info('Request Start', {
    method,
    url,
    body,
    query,
    params,
    timestamp: new Date().toISOString()
  });

  // 응답 완료 시 로그
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request End', {
      method,
      url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
};

module.exports = loggingMiddleware; 