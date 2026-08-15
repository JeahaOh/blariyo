const logger = require('../utils/logger');

// class ApiError extends Error {
//   constructor(status, message) {
//     super(message);
//     this.status = status;
//     this.name = 'ApiError';
//   }
// }

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

module.exports = {
  errorHandler,
};
