const winston = require('winston');

/**
 * 全局日志工具：
 *   - 开发环境：控制台彩色输出
 *   - 生产环境：JSON 格式，按级别过滤（默认 info 及以上）
 *   - 所有模块 require('./utils/logger') 即可，避免散落 console.*
 *
 * 兼容方法名：logger.info / warn / error / debug
 */

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logFormat = process.env.NODE_ENV === 'production'
  ? winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${stack ? message + '\n' + stack : message}${rest}`;
      })
    );

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  transports: [
    new winston.transports.Console({ handleExceptions: true }),
    // 可以在这里加 File transport 做持久化
  ],
  exitOnError: false,
});

// 兼容 API：给希望保留 console 风格调用的代码做一层薄封装
logger.log = (level, msg, ...meta) => {
  if (typeof logger[level] === 'function') {
    logger[level](msg, ...meta);
  } else {
    logger.info(msg, ...meta);
  }
};

module.exports = logger;
