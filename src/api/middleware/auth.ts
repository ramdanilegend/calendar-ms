import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config/config';

// Define user roles
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

// JWT payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Extend Express Request to include user data
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Custom error class for authentication errors
export class AuthenticationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 401, code: string = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// JWT validation middleware
export const authenticateToken = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    const error = new AuthenticationError('Access token is required', 401, 'TOKEN_REQUIRED');
    return next(error);
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const authError = new AuthenticationError('Token has expired', 401, 'TOKEN_EXPIRED');
      return next(authError);
    } else if (error instanceof jwt.JsonWebTokenError) {
      const authError = new AuthenticationError('Invalid token', 401, 'TOKEN_INVALID');
      return next(authError);
    } else {
      const authError = new AuthenticationError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED');
      return next(authError);
    }
  }
};

// Role-based access control middleware
export const requireRole = (requiredRole: UserRole) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      const error = new AuthenticationError('Authentication required', 401, 'AUTH_REQUIRED');
      return next(error);
    }

    if (req.user.role !== requiredRole) {
      const error = new AuthenticationError(
        `Access denied. Required role: ${requiredRole}`,
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
      return next(error);
    }

    next();
  };
};

// Admin-only access middleware
export const requireAdmin = requireRole(UserRole.ADMIN);

// Utility function for token generation (for testing)
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string | number = '24h'): string => {
  return jwt.sign(payload as object, config.jwtSecret, { expiresIn } as any);
};

// Token validation utility (without middleware)
export const validateToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as JWTPayload;
  } catch (error) {
    return null;
  }
};

// Middleware to extract user info without requiring authentication (optional auth)
export const optionalAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
      req.user = decoded;
    } catch (error) {
      // Silently ignore token errors for optional auth
      req.user = undefined;
    }
  }

  next();
};
