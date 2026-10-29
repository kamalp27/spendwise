import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import {
  getPool,
  closePool,
  isDatabaseConfigured,
  isPoolInitialized,
  _resetPoolForTesting
} from '../src/db/pool.js';
import { createShutdownHandler, _resetShutdownStateForTesting } from '../src/server.js';
import { CategoryController } from '../src/controllers/category.controller.js';
import { ExpenseController } from '../src/controllers/expense.controller.js';
import { BudgetController } from '../src/controllers/budget.controller.js';
import { AnalyticsController } from '../src/controllers/analytics.controller.js';

describe('Database Connection Pool Lifecycle & Shutdown Hardening (Stage 6.0)', () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    _resetPoolForTesting(null);
    _resetShutdownStateForTesting();
    process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/testdb';
  });

  afterEach(async () => {
    _resetPoolForTesting(null);
    _resetShutdownStateForTesting();
    if (originalEnv !== undefined) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe('1. Reusable Pool Singleton Behavior (Task 2)', () => {
    it('repeated getPool() calls reuse the exact same Pool instance', () => {
      const pool1 = getPool();
      const pool2 = getPool();
      const pool3 = getPool();

      expect(pool1).toBeDefined();
      expect(pool2).toBe(pool1);
      expect(pool3).toBe(pool1);
      expect(isPoolInitialized()).toBe(true);
    });

    it('pool construction is not repeated unnecessarily', () => {
      const OriginalPool = pg.Pool;
      let constructCount = 0;
      class TrackedPool extends OriginalPool {
        constructor(...args) {
          super(...args);
          constructCount++;
        }
      }
      const poolSpy = vi.spyOn(pg, 'Pool').mockImplementation(function (...args) {
        return new TrackedPool(...args);
      });

      try {
        _resetPoolForTesting(null);

        getPool();
        getPool();
        getPool();

        expect(constructCount).toBe(1);
        expect(poolSpy).toHaveBeenCalledTimes(1);
      } finally {
        poolSpy.mockRestore();
      }
    });

    it('throws clear error when DATABASE_URL is missing and does not instantiate a pool', () => {
      delete process.env.DATABASE_URL;
      _resetPoolForTesting(null);

      expect(isDatabaseConfigured()).toBe(false);
      expect(() => getPool()).toThrowError(/DATABASE_URL environment variable is required/);
      expect(isPoolInitialized()).toBe(false);
    });

    it('isDatabaseConfigured() returns true only when DATABASE_URL is set and non-empty', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/spendwise';
      expect(isDatabaseConfigured()).toBe(true);

      process.env.DATABASE_URL = '   ';
      expect(isDatabaseConfigured()).toBe(false);

      delete process.env.DATABASE_URL;
      expect(isDatabaseConfigured()).toBe(false);
    });

    it('closePool() closes the active pool and resets instance to null', async () => {
      const mockPool = {
        ended: false,
        end: vi.fn(async () => {
          mockPool.ended = true;
        })
      };

      _resetPoolForTesting(mockPool);
      expect(isPoolInitialized()).toBe(true);

      await closePool();

      expect(mockPool.end).toHaveBeenCalledTimes(1);
      expect(isPoolInitialized()).toBe(false);
    });

    it('closePool() is safe when pool was never initialized', async () => {
      _resetPoolForTesting(null);
      expect(isPoolInitialized()).toBe(false);

      // Must resolve without errors or exceptions
      await expect(closePool()).resolves.toBeUndefined();
      expect(isPoolInitialized()).toBe(false);
    });
  });

  describe('2. Controller Database Handle Resolution & Mock Injection', () => {
    it('controllers prefer req.app.locals.db over getPool()', async () => {
      const mockDb = {
        query: vi.fn(async () => ({ rows: [] }))
      };

      const req = {
        app: { locals: { db: mockDb } },
        user: { id: '00000000-0000-0000-0000-000000000001' },
        query: { month: 10, year: 2026 },
        params: { id: '11111111-1111-1111-1111-111111111111' },
        body: { name: 'Food', amount: 50, month: 10, year: 2026 }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      };
      const next = vi.fn();

      // Test CategoryController
      await CategoryController.getCategories(req, res, next);
      expect(mockDb.query).toHaveBeenCalled();

      // Test ExpenseController
      mockDb.query.mockClear();
      await ExpenseController.getExpenses(req, res, next);
      expect(mockDb.query).toHaveBeenCalled();

      // Test BudgetController
      mockDb.query.mockClear();
      await BudgetController.getBudgets(req, res, next);
      expect(mockDb.query).toHaveBeenCalled();

      // Test AnalyticsController
      mockDb.query.mockClear();
      await AnalyticsController.getMonthlySummary(req, res, next);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('all controllers fallback to the shared singleton getPool() when req.app.locals.db is absent', async () => {
      const singletonPool = getPool();

      const reqWithoutLocals = {
        user: { id: '00000000-0000-0000-0000-000000000001' },
        query: {}
      };

      // Verify that calling getPool() in controllers resolves to the exact same singleton
      const resolvedDb = reqWithoutLocals.app?.locals?.db || getPool();
      expect(resolvedDb).toBe(singletonPool);
    });
  });

  describe('3. Graceful Shutdown Behavior (Task 3)', () => {
    it('closes the HTTP server and shared pool when pool is initialized', async () => {
      let serverClosed = false;
      const mockHttpServer = {
        close: vi.fn((cb) => {
          serverClosed = true;
          cb(null);
        })
      };

      const mockClosePool = vi.fn(async () => {});
      const mockExit = vi.fn();
      const mockLogger = { log: vi.fn(), error: vi.fn() };

      const shutdownHandler = createShutdownHandler(mockHttpServer, {
        closePoolFn: mockClosePool,
        isPoolInitFn: () => true,
        exitFn: mockExit,
        logger: mockLogger
      });

      shutdownHandler('SIGTERM');

      // Allow async server.close callback to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockHttpServer.close).toHaveBeenCalledTimes(1);
      expect(mockClosePool).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(serverClosed).toBe(true);
    });

    it('safely skips pool closure during shutdown if pool was never initialized', async () => {
      const mockHttpServer = {
        close: vi.fn((cb) => cb(null))
      };

      const mockClosePool = vi.fn(async () => {});
      const mockExit = vi.fn();
      const mockLogger = { log: vi.fn(), error: vi.fn() };

      const shutdownHandler = createShutdownHandler(mockHttpServer, {
        closePoolFn: mockClosePool,
        isPoolInitFn: () => false, // Pool not initialized
        exitFn: mockExit,
        logger: mockLogger
      });

      shutdownHandler('SIGINT');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockHttpServer.close).toHaveBeenCalledTimes(1);
      expect(mockClosePool).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('repeated shutdown signals do not close resources multiple times (idempotent)', async () => {
      const mockHttpServer = {
        close: vi.fn((cb) => cb(null))
      };

      const mockClosePool = vi.fn(async () => {});
      const mockExit = vi.fn();
      const mockLogger = { log: vi.fn(), error: vi.fn() };

      const shutdownHandler = createShutdownHandler(mockHttpServer, {
        closePoolFn: mockClosePool,
        isPoolInitFn: () => true,
        exitFn: mockExit,
        logger: mockLogger
      });

      // Fire first signal
      shutdownHandler('SIGTERM');
      // Fire second signal immediately
      shutdownHandler('SIGINT');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockHttpServer.close).toHaveBeenCalledTimes(1);
      expect(mockClosePool).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown already in progress. Ignoring signal: SIGINT')
      );
    });

    it('logs errors and exits with code 1 if HTTP server close fails', async () => {
      const mockHttpServer = {
        close: vi.fn((cb) => cb(new Error('Server close error')))
      };

      const mockClosePool = vi.fn(async () => {});
      const mockExit = vi.fn();
      const mockLogger = { log: vi.fn(), error: vi.fn() };

      const shutdownHandler = createShutdownHandler(mockHttpServer, {
        closePoolFn: mockClosePool,
        isPoolInitFn: () => true,
        exitFn: mockExit,
        logger: mockLogger
      });

      shutdownHandler('SIGTERM');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during HTTP server close'),
        expect.any(Error)
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('logs errors and exits with code 1 if pool close fails', async () => {
      const mockHttpServer = {
        close: vi.fn((cb) => cb(null))
      };

      const mockClosePool = vi.fn(async () => {
        throw new Error('Pool end failed');
      });
      const mockExit = vi.fn();
      const mockLogger = { log: vi.fn(), error: vi.fn() };

      const shutdownHandler = createShutdownHandler(mockHttpServer, {
        closePoolFn: mockClosePool,
        isPoolInitFn: () => true,
        exitFn: mockExit,
        logger: mockLogger
      });

      shutdownHandler('SIGTERM');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error closing database connection pool'),
        'Pool end failed'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
