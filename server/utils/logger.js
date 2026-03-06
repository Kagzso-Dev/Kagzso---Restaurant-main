/**
 * ─── Winston Logger ──────────────────────────────────────────────────────────
 * Production-grade structured logging with:
 *   • Console output (colorized in dev, JSON in prod)
 *   • File transports — error.log + combined.log
 *   • Request/response logging middleware
 *   • Performance tracing helpers
 *   • Log rotation friendly (append mode)
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('Payment failed', { orderId, err });
 */
const { createLogger, format, transports } = require('winston');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

// ── Custom format: timestamp + level + message + metadata ────────────────────
const baseFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
);

// ── Console format (colorized in dev) ────────────────────────────────────────
const consoleFormat = isProd
    ? format.combine(baseFormat, format.json())
    : format.combine(
        baseFormat,
        format.colorize(),
        format.printf(({ timestamp, level, message, metadata }) => {
            const meta = Object.keys(metadata).length
                ? ` ${JSON.stringify(metadata)}`
                : '';
            return `${timestamp} ${level}: ${message}${meta}`;
        }),
    );

// ── Logger Instance ──────────────────────────────────────────────────────────
const logger = createLogger({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    defaultMeta: { service: 'kagzso-pos' },
    transports: [
        new transports.Console({
            format: consoleFormat,
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false, // Do not exit on handled exceptions
});

// ── File transports (production only — avoids cluttering dev) ────────────────
if (isProd) {
    logger.add(new transports.File({
        filename: path.join(LOG_DIR, 'error.log'),
        level: 'error',
        format: format.combine(baseFormat, format.json()),
        maxsize: 10 * 1024 * 1024, // 10 MB per file
        maxFiles: 5,
        tailable: true,
    }));
    logger.add(new transports.File({
        filename: path.join(LOG_DIR, 'combined.log'),
        format: format.combine(baseFormat, format.json()),
        maxsize: 20 * 1024 * 1024, // 20 MB per file
        maxFiles: 10,
        tailable: true,
    }));
}

// ── Request Logging Middleware ────────────────────────────────────────────────
/**
 * Express middleware that logs every HTTP request with timing.
 *   app.use(logger.requestLogger);
 */
logger.requestLogger = (req, res, next) => {
    const start = Date.now();

    // Attach a unique request ID for tracing
    req.requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader('X-Request-Id', req.requestId);

    // On response finish, log the request
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            requestId: req.requestId,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')?.substring(0, 100),
        };

        // Add user context if authenticated
        if (req.userId) {
            logData.userId = req.userId;
            logData.role = req.role;
        }

        if (res.statusCode >= 500) {
            logger.error('Request failed', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Client error', logData);
        } else if (duration > 2000) {
            // Flag slow requests
            logger.warn('Slow request', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

// ── Performance Tracing Helper ───────────────────────────────────────────────
/**
 * Creates a timer for measuring operation duration.
 *   const t = logger.startTimer('aggregateAnalytics');
 *   // ... do work ...
 *   t.done({ extra: 'metadata' });
 */
logger.startTimer = (label) => {
    const start = Date.now();
    return {
        done: (meta = {}) => {
            const duration = Date.now() - start;
            logger.info(`⏱ ${label}`, { ...meta, duration: `${duration}ms` });
            return duration;
        },
    };
};

module.exports = logger;
