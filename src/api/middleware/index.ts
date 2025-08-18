// Authentication middleware
export {
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
} from './auth';

// Error handling middleware
export {
  authErrorHandler,
  rateLimitErrorHandler,
  securityHeaders,
  contentSecurityPolicy
} from './errorHandler';

// Rate limiting and security middleware
export {
  createRateLimiter,
  publicRateLimit,
  adminRateLimit,
  authRateLimit,
  customRateLimit,
  httpsOnly,
  limitRequestSize,
  rateLimitConfigs
} from './rateLimiter';

// Logging middleware (existing)
export { default as logging } from './logging';
