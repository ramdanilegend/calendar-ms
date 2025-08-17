import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'calendar-ms' },
  transports: [
    // Write to all logs with level 'info' and below to 'combined.log'
    new winston.transports.File({ filename: path.join(__dirname, '../../../logs/combined.log') }),
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({ filename: path.join(__dirname, '../../../logs/error.log'), level: 'error' }),
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create the request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
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

// Create a middleware to log errors
export const errorLogger = (err: Error, req: Request, _res: Response, next: NextFunction): void => {
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

export default logger;
