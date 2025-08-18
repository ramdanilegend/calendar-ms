import { Request, Response, NextFunction } from 'express';
import { rateLimitErrorHandler } from './errorHandler';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Rate limit store interface
interface RateLimitStore {
  [key: string]: {
    requests: number;
    resetTime: number;
  };
}

// Default configurations for different endpoint types
export const rateLimitConfigs = {
  // Public endpoints - more restrictive
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  // Admin endpoints - less restrictive but still limited
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  // Auth endpoints (login/register) - very restrictive
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  }
};

// In-memory store (in production, use Redis or similar)
const rateLimitStore: RateLimitStore = {};

// Clean up expired entries periodically
let cleanupInterval: NodeJS.Timeout | null = null;

// Initialize cleanup interval
const initCleanup = () => {
  if (cleanupInterval === null && process.env.NODE_ENV !== 'test') {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(rateLimitStore).forEach(key => {
        if (rateLimitStore[key].resetTime < now) {
          delete rateLimitStore[key];
        }
      });
    }, 10 * 60 * 1000); // Cleanup every 10 minutes
  }
};

// Clean up function for tests
export const clearRateLimitStore = () => {
  Object.keys(rateLimitStore).forEach(key => {
    delete rateLimitStore[key];
  });
};

// Cleanup interval for tests
export const stopCleanupInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Initialize cleanup on module load
initCleanup();

// Rate limiter factory
export const createRateLimiter = (config: RateLimitConfig) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getClientKey(req);
    const now = Date.now();
    
    // Get or create client entry
    let client = rateLimitStore[key];
    
    if (!client || client.resetTime < now) {
      // Create new entry or reset expired entry
      client = {
        requests: 0,
        resetTime: now + config.windowMs
      };
      rateLimitStore[key] = client;
    }

    // Check if limit exceeded
    if (client.requests >= config.maxRequests) {
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(client.resetTime / 1000).toString(),
        'Retry-After': Math.ceil((client.resetTime - now) / 1000).toString()
      });

      rateLimitErrorHandler(req, res);
      return;
    }

    // Increment request count
    client.requests += 1;

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': (config.maxRequests - client.requests).toString(),
      'X-RateLimit-Reset': Math.ceil(client.resetTime / 1000).toString()
    });

    // Handle response to potentially skip counting
    const originalSend = res.send;
    res.send = function(body) {
      const statusCode = res.statusCode;
      
      // Skip counting based on configuration
      if (
        (config.skipSuccessfulRequests && statusCode < 400) ||
        (config.skipFailedRequests && statusCode >= 400)
      ) {
        client.requests -= 1;
      }
      
      return originalSend.call(this, body);
    };

    next();
  };
};

// Get client identifier (IP + User Agent hash)
function getClientKey(req: Request): string {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Simple hash function for user agent
  let hash = 0;
  for (let i = 0; i < userAgent.length; i++) {
    const char = userAgent.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `${ip}:${hash}`;
}

// Pre-configured middleware instances
export const publicRateLimit = createRateLimiter(rateLimitConfigs.public);
export const adminRateLimit = createRateLimiter(rateLimitConfigs.admin);
export const authRateLimit = createRateLimiter(rateLimitConfigs.auth);

// Custom rate limiter for specific endpoints
export const customRateLimit = (maxRequests: number, windowMinutes: number = 15) => {
  return createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    maxRequests,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });
};

// HTTPS enforcement middleware
export const httpsOnly = (req: Request, res: Response, next: NextFunction): void => {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is secure
  if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  next();
};

// Request size limiting middleware
export const limitRequestSize = (maxSizeBytes: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request size exceeds limit of ${maxSizeBytes} bytes`,
          timestamp: new Date().toISOString(),
          path: req.originalUrl || req.url,
          method: req.method
        }
      });
      return;
    }

    next();
  };
};
