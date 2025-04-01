const logger = require('./logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`[ERROR] ${err.stack}`);

  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`${err.status || 500} - ${message} - ${req.originalUrl}`);

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
