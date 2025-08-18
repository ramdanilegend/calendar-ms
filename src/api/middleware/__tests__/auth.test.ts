import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  requireRole,
  requireAdmin,
  generateToken,
  validateToken,
  optionalAuth,
  UserRole,
  JWTPayload,
  AuthenticationError,
  AuthenticatedRequest
} from '../auth';
import config from '../../../config/config';

// Mock Express objects
const mockRequest = (headers: any = {}): Partial<AuthenticatedRequest> => ({
  headers,
  user: undefined
});

const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = (): jest.MockedFunction<NextFunction> => jest.fn();

describe('Authentication Middleware', () => {
  const validPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: 'user123',
    email: 'test@example.com',
    role: UserRole.USER
  };

  const adminPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: 'admin123',
    email: 'admin@example.com',
    role: UserRole.ADMIN
  };

  let validToken: string;
  let expiredToken: string;
  let invalidToken: string;

  beforeAll(() => {
    // Generate test tokens
    validToken = generateToken(validPayload);
    
    // Generate expired token
    expiredToken = jwt.sign(validPayload, config.jwtSecret, { expiresIn: '-1h' });
    
    // Invalid token
    invalidToken = 'invalid.token.here';
  });

  describe('authenticateToken middleware', () => {
    it('should authenticate valid token', () => {
      const req = mockRequest({
        authorization: `Bearer ${validToken}`
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      authenticateToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user?.userId).toBe(validPayload.userId);
      expect(req.user?.email).toBe(validPayload.email);
      expect(req.user?.role).toBe(validPayload.role);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', () => {
      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      authenticateToken(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('TOKEN_REQUIRED');
      expect(error.statusCode).toBe(401);
    });

    it('should reject request with malformed authorization header', () => {
      const req = mockRequest({
        authorization: 'InvalidFormat'
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('TOKEN_REQUIRED');
    });

    it('should reject expired token', () => {
      const req = mockRequest({
        authorization: `Bearer ${expiredToken}`
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('TOKEN_EXPIRED');
      expect(error.statusCode).toBe(401);
    });

    it('should reject invalid token', () => {
      const req = mockRequest({
        authorization: `Bearer ${invalidToken}`
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('TOKEN_INVALID');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('requireRole middleware', () => {
    it('should allow user with correct role', () => {
      const req = mockRequest() as AuthenticatedRequest;
      req.user = { ...validPayload, iat: Date.now(), exp: Date.now() + 3600 };
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = requireRole(UserRole.USER);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject user with incorrect role', () => {
      const req = mockRequest() as AuthenticatedRequest;
      req.user = { ...validPayload, iat: Date.now(), exp: Date.now() + 3600 };
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = requireRole(UserRole.ADMIN);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(error.statusCode).toBe(403);
    });

    it('should reject unauthenticated user', () => {
      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = requireRole(UserRole.USER);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('AUTH_REQUIRED');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('requireAdmin middleware', () => {
    it('should allow admin user', () => {
      const req = mockRequest() as AuthenticatedRequest;
      req.user = { ...adminPayload, iat: Date.now(), exp: Date.now() + 3600 };
      const res = mockResponse() as Response;
      const next = mockNext();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject non-admin user', () => {
      const req = mockRequest() as AuthenticatedRequest;
      req.user = { ...validPayload, iat: Date.now(), exp: Date.now() + 3600 };
      const res = mockResponse() as Response;
      const next = mockNext();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      
      const error = next.mock.calls[0][0] as unknown as AuthenticationError;
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('generateToken utility', () => {
    it('should generate valid token', () => {
      const token = generateToken(validPayload);
      const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.email).toBe(validPayload.email);
      expect(decoded.role).toBe(validPayload.role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should generate token with custom expiration', () => {
      const token = generateToken(validPayload, '1h');
      const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

      expect(decoded.exp! - decoded.iat!).toBe(3600); // 1 hour in seconds
    });
  });

  describe('validateToken utility', () => {
    it('should validate correct token', () => {
      const result = validateToken(validToken);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(validPayload.userId);
      expect(result?.email).toBe(validPayload.email);
      expect(result?.role).toBe(validPayload.role);
    });

    it('should return null for invalid token', () => {
      const result = validateToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const result = validateToken(expiredToken);
      expect(result).toBeNull();
    });
  });

  describe('optionalAuth middleware', () => {
    it('should set user if valid token provided', () => {
      const req = mockRequest({
        authorization: `Bearer ${validToken}`
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user?.userId).toBe(validPayload.userId);
      expect(next).toHaveBeenCalledWith();
    });

    it('should not set user if invalid token provided', () => {
      const req = mockRequest({
        authorization: `Bearer ${invalidToken}`
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should not set user if no token provided', () => {
      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('AuthenticationError class', () => {
    it('should create error with default values', () => {
      const error = new AuthenticationError('Test message');

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create error with custom values', () => {
      const error = new AuthenticationError('Custom message', 403, 'CUSTOM_CODE');

      expect(error.message).toBe('Custom message');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('CUSTOM_CODE');
    });
  });
});
