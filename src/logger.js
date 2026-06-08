import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: 'http',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
  },
  format: IS_PRODUCTION
    ? combine(timestamp(), json())
    : combine(colorize(), simple()),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;
