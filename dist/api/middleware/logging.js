"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorLogger = exports.requestLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
// Configure Winston logger
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json()),
    defaultMeta: { service: 'calendar-ms' },
    transports: [
        // Write to all logs with level 'info' and below to 'combined.log'
        new winston_1.default.transports.File({ filename: path_1.default.join(__dirname, '../../../logs/combined.log') }),
        // Write all logs with level 'error' and below to 'error.log'
        new winston_1.default.transports.File({ filename: path_1.default.join(__dirname, '../../../logs/error.log'), level: 'error' }),
    ]
});
// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
    }));
}
// Create the request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    // Log when the response is finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('user-agent') || ''
        });
    });
    next();
};
exports.requestLogger = requestLogger;
// Create a middleware to log errors
const errorLogger = (err, req, _res, next) => {
    logger.error('Error processing request', {
        error: {
            message: err.message,
            stack: err.stack
        },
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent') || ''
    });
    next(err);
};
exports.errorLogger = errorLogger;
exports.default = logger;
//# sourceMappingURL=logging.js.map