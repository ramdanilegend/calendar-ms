import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from './auth';

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    path: string;
    method: string;
  };
  requestId?: string;
}

// Authentication and security error handler middleware
export const authErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);

  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;
  const method = req.method;

  // Handle authentication errors
  if (error instanceof AuthenticationError) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp,
        path,
        method
      },
      requestId
    };

    // Log authentication failures (but don't log sensitive info)
    console.error(`[AUTH ERROR] ${timestamp} ${method} ${path} - ${error.code}: ${error.message}`, {
      requestId,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      code: error.code
    });

    // Set security headers for auth errors
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Pass to next error handler if not an authentication error
  next(error);
};

// Rate limiting error handler
export const rateLimitErrorHandler = (req: Request, res: Response): void => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      timestamp,
      path: req.originalUrl || req.url,
      method: req.method
    },
    requestId
  };

  // Log rate limit violations
  console.warn(`[RATE LIMIT] ${timestamp} ${req.method} ${req.originalUrl || req.url}`, {
    requestId,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  });

  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + 3600, // 1 hour from now
    'Retry-After': '3600'
  });

  res.status(429).json(errorResponse);
};

// Security headers middleware
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Set basic security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none'
  });

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// Content Security Policy middleware
export const contentSecurityPolicy = (_req: Request, res: Response, next: NextFunction): void => {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.set('Content-Security-Policy', csp);
  next();
};
