import { Request, Response, NextFunction } from 'express';
import {
  createRateLimiter,
  customRateLimit,
  httpsOnly,
  limitRequestSize,
  rateLimitConfigs,
  clearRateLimitStore,
  stopCleanupInterval
} from '../rateLimiter';

// Mock Express objects
const mockRequest = (overrides: any = {}): Partial<Request> => ({
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' } as any,
  headers: { 'user-agent': 'test-agent' },
  url: '/test',
  originalUrl: '/test',
  method: 'GET',
  secure: false,
  ...overrides
});

const mockResponse = (): Partial<Response> => {
  const res: any = {
    headersSent: false,
    headers: {},
    statusCode: 200
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.set = jest.fn((headers, value?) => {
    if (typeof headers === 'object') {
      Object.assign(res.headers, headers);
    } else if (typeof headers === 'string' && value !== undefined) {
      res.headers[headers] = value;
    }
    return res;
  });
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = (): jest.MockedFunction<NextFunction> => jest.fn();

// Mock console methods
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalConsoleWarn;
  stopCleanupInterval();
});

describe('Rate Limiter Middleware', () => {
  describe('createRateLimiter', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Clear rate limit store between tests
      clearRateLimitStore();
      jest.clearAllTimers();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow requests under the limit', () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000, // 1 minute
        maxRequests: 5
      });

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      // First request should be allowed
      rateLimiter(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '4',
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should block requests over the limit', () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2
      });

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      // Make requests up to the limit
      rateLimiter(req, res, next);
      rateLimiter(req, res, next);

      // Third request should be blocked
      jest.clearAllMocks();
      rateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET'
        },
        requestId: expect.any(String)
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reset count after window expires', () => {
      const rateLimiter = createRateLimiter({
        windowMs: 1000, // 1 second
        maxRequests: 1
      });

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      // First request
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request should be blocked
      jest.clearAllMocks();
      rateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);

      // Fast-forward past window
      jest.advanceTimersByTime(1001);

      // Third request should be allowed again
      jest.clearAllMocks();
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should track different clients separately', () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1
      });

      const req1 = mockRequest({ ip: '127.0.0.1' }) as Request;
      const req2 = mockRequest({ ip: '192.168.1.1' }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      // Both clients should be allowed one request each
      rateLimiter(req1, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      rateLimiter(req2, res, next);
      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('Pre-configured rate limiters', () => {
    beforeEach(() => {
      clearRateLimitStore();
    });

    it('should have correct configuration for public rate limit', () => {
      expect(rateLimitConfigs.public.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.public.maxRequests).toBe(100);
    });

    it('should have correct configuration for admin rate limit', () => {
      expect(rateLimitConfigs.admin.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.admin.maxRequests).toBe(1000);
    });

    it('should have correct configuration for auth rate limit', () => {
      expect(rateLimitConfigs.auth.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.auth.maxRequests).toBe(5);
    });
  });

  describe('customRateLimit', () => {
    beforeEach(() => {
      clearRateLimitStore();
    });

    it('should create rate limiter with custom settings', () => {
      const rateLimiter = customRateLimit(10, 5); // 10 requests per 5 minutes

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      rateLimiter(req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '9',
        'X-RateLimit-Reset': expect.any(String)
      });
    });
  });

  describe('httpsOnly', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      clearRateLimitStore();
    });

    it('should allow secure requests in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = mockRequest({ secure: true }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      httpsOnly(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.redirect).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should redirect non-secure requests in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = mockRequest({
        secure: false,
        headers: { host: 'example.com' },
        url: '/api/test'
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      httpsOnly(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/test');
      expect(next).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should allow requests with x-forwarded-proto header in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = mockRequest({
        secure: false,
        headers: { 'x-forwarded-proto': 'https' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      httpsOnly(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.redirect).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should skip check in development', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = mockRequest({ secure: false }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      httpsOnly(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.redirect).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('limitRequestSize', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      clearRateLimitStore();
    });

    it('should allow requests under size limit', () => {
      const middleware = limitRequestSize(1000); // 1KB limit

      const req = mockRequest({
        headers: { 'content-length': '500' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject requests over size limit', () => {
      const middleware = limitRequestSize(1000); // 1KB limit

      const req = mockRequest({
        headers: { 'content-length': '2000' },
        originalUrl: '/api/upload',
        method: 'POST'
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request size exceeds limit of 1000 bytes',
          timestamp: expect.any(String),
          path: '/api/upload',
          method: 'POST'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use default limit if none specified', () => {
      const middleware = limitRequestSize();

      const req = mockRequest({
        headers: { 'content-length': '500000' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should handle missing content-length header', () => {
      const middleware = limitRequestSize(1000);

      const req = mockRequest({
        headers: {}
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});
