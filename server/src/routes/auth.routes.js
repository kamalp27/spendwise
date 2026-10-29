import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller.js';
import { sessionAuthMiddleware } from '../middleware/session-auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { env } from '../config/env.js';

const router = Router();

// Dedicated Brute-Force Rate Limiting for Login & Registration
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isTest ? 1000 : 5, // 5 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    }
  }
});

// Public Authentication Endpoints (Guarded by rate limiter & CSRF defense)
router.post('/register', authLimiter, csrfProtection, AuthController.register);
router.post('/login', authLimiter, csrfProtection, AuthController.login);

// Authenticated Session Endpoints (Guarded by session auth & CSRF defense)
router.post('/logout', csrfProtection, sessionAuthMiddleware, AuthController.logout);
router.get('/me', sessionAuthMiddleware, AuthController.getMe);

export default router;
