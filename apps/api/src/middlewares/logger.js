const winston = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize } = winston.format;

const logLevel = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level}: ${message}`;
});

const logger = winston.createLogger({
  level: logLevel,
  format: combine(timestamp(), logFormat),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error', // error 레벨만 저장
    }),
    new winston.transports.File({
      filename: 'logs/warn.log',
      level: 'warn', // warn 이상 저장
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: 'info', // info 이상 저장
    }),
  ],
});

if (!isProd) {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), logFormat),
    })
  );
}

module.exports = logger;
