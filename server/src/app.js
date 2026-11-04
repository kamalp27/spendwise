import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import categoryRoutes from './routes/category.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import { sessionAuthMiddleware } from './middleware/session-auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp({
  trustProxy = env.TRUST_PROXY,
  allowedOrigins = (env.CLIENT_URLS && env.CLIENT_URLS.length > 0 ? env.CLIENT_URLS : [env.CLIENT_URL])
} = {}) {
  const app = express();

  // 1. Reverse Proxy Trust Configuration (Render / production PaaS)
  if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  // 2. Security Headers via Helmet
  app.use(helmet());

  // 3. Strict CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, Supertest)
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-SpendWise-CSRF'
      ]
    })
  );

  // 4. API Rate Limiting (disabled or high allowance during automated tests)
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.isTest ? 1000 : env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    }
  });
  app.use('/api', limiter);

  // 5. Body & Cookie Parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  // 6. Public Health Routes (Database-independent)
  app.use('/api/v1', healthRoutes);

  // 7. Authentication Foundation Routes
  app.use('/api/v1/auth', authRoutes);

  // 8. Authenticated Domain Routes (Guarded by sessionAuthMiddleware and csrfProtection)
  app.use('/api/v1', sessionAuthMiddleware, csrfProtection, [
    categoryRoutes,
    expenseRoutes,
    budgetRoutes,
    analyticsRoutes
  ]);

  // 9. Handle Unknown Routes (404)
  app.use(notFoundHandler);

  // 10. Centralized Error Handler (500, parsing errors, CORS errors, AppErrors)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
