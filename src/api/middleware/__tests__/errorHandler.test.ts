import { Request, Response, NextFunction } from 'express';
import {
  authErrorHandler,
  rateLimitErrorHandler,
  securityHeaders,
  contentSecurityPolicy
} from '../errorHandler';
import { AuthenticationError } from '../auth';

// Mock Express objects
const mockRequest = (overrides: any = {}): Partial<Request> => ({
  originalUrl: '/test',
  url: '/test',
  method: 'GET',
  headers: {},
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' } as any,
  ...overrides
});

const mockResponse = (): Partial<Response> => {
  const res: any = {
    headersSent: false,
    headers: {}
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn((headers) => {
    Object.assign(res.headers, headers);
    return res;
  });
  return res;
};

const mockNext = (): jest.MockedFunction<NextFunction> => jest.fn();

// Mock console methods to avoid test output noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Error Handler Middleware', () => {
  describe('authErrorHandler', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle AuthenticationError properly', () => {
      const req = mockRequest({
        headers: { 'user-agent': 'test-agent' },
        originalUrl: '/api/admin',
        method: 'POST'
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const authError = new AuthenticationError('Invalid token', 401, 'TOKEN_INVALID');

      authErrorHandler(authError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token',
          timestamp: expect.any(String),
          path: '/api/admin',
          method: 'POST'
        },
        requestId: expect.any(String)
      });

      expect(res.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      expect(console.error).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass non-authentication errors to next handler', () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const genericError = new Error('Generic error');

      authErrorHandler(genericError, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(genericError);
    });

    it('should use request ID from headers if provided', () => {
      const req = mockRequest({
        headers: { 'x-request-id': 'custom-request-id' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const authError = new AuthenticationError('Test error');

      authErrorHandler(authError, req, res, next);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.requestId).toBe('custom-request-id');
    });
  });

  describe('rateLimitErrorHandler', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle rate limit errors properly', () => {
      const req = mockRequest({
        originalUrl: '/api/public',
        method: 'GET',
        headers: { 'user-agent': 'test-agent' },
        ip: '192.168.1.1'
      }) as Request;
      const res = mockResponse() as Response;

      rateLimitErrorHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          timestamp: expect.any(String),
          path: '/api/public',
          method: 'GET'
        },
        requestId: expect.any(String)
      });

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': expect.any(Number),
        'Retry-After': '3600'
      });

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('securityHeaders', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should set basic security headers', () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      securityHeaders(req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-DNS-Prefetch-Control': 'off',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none'
      });

      expect(next).toHaveBeenCalledWith();
    });

    it('should add HSTS header in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      securityHeaders(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
        })
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not add HSTS header in development', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      securityHeaders(req, res, next);

      const setCall = (res.set as jest.Mock).mock.calls[0][0];
      expect(setCall['Strict-Transport-Security']).toBeUndefined();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('contentSecurityPolicy', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should set CSP header', () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      contentSecurityPolicy(req, res, next);

      const expectedCSP = [
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

      expect(res.set).toHaveBeenCalledWith('Content-Security-Policy', expectedCSP);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
