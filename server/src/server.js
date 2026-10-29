import path from 'path';
import { fileURLToPath } from 'url';
import { app } from './app.js';
import { env } from './config/env.js';
import { getPool, closePool, isPoolInitialized, isDatabaseConfigured } from './db/pool.js';

let isShuttingDown = false;

/**
 * Creates an idempotent graceful shutdown handler.
 * Closes the HTTP server first to drain in-flight requests, then closes the database pool.
 *
 * @param {import('http').Server} httpServer
 * @param {Object} [options]
 * @param {Function} [options.closePoolFn]
 * @param {Function} [options.isPoolInitFn]
 * @param {Function} [options.exitFn]
 * @param {Object} [options.logger]
 * @param {number} [options.forceTimeoutMs]
 * @returns {(signal: string) => void}
 */
export function createShutdownHandler(httpServer, {
  closePoolFn = closePool,
  isPoolInitFn = isPoolInitialized,
  exitFn = process.exit,
  logger = console,
  forceTimeoutMs = 10000
} = {}) {
  return function handleShutdown(signal) {
    if (isShuttingDown) {
      logger.log(`[SpendWise API] Shutdown already in progress. Ignoring signal: ${signal}`);
      return;
    }
    isShuttingDown = true;

    logger.log(`\n[SpendWise API] Received ${signal}. Starting graceful shutdown...`);

    // Force exit after timeout if connections fail to close
    const forceExitTimeout = setTimeout(() => {
      logger.error('[SpendWise API] Forced shutdown due to timeout.');
      exitFn(1);
    }, forceTimeoutMs);
    forceExitTimeout.unref();

    httpServer.close(async (err) => {
      let exitCode = 0;
      if (err) {
        logger.error('[SpendWise API] Error during HTTP server close:', err);
        exitCode = 1;
      } else {
        logger.log('[SpendWise API] HTTP server closed gracefully.');
      }

      // Close shared PostgreSQL pool if initialized
      try {
        if (isPoolInitFn()) {
          logger.log('[SpendWise API] Closing database connection pool...');
          await closePoolFn();
          logger.log('[SpendWise API] Database connection pool closed gracefully.');
        } else {
          logger.log('[SpendWise API] Database pool was not initialized; skipping pool closure.');
        }
      } catch (poolErr) {
        logger.error('[SpendWise API] Error closing database connection pool:', poolErr.message);
        exitCode = 1;
      }

      clearTimeout(forceExitTimeout);
      logger.log('[SpendWise API] Graceful shutdown complete.');
      exitFn(exitCode);
    });
  };
}

/**
 * For testing purposes only: resets the internal shutdown flag.
 */
export function _resetShutdownStateForTesting() {
  isShuttingDown = false;
}

/**
 * Starts the HTTP server and attaches graceful shutdown handlers.
 *
 * @param {number} [port=env.PORT]
 * @returns {import('http').Server}
 */
export function startServer(port = env.PORT) {
  // Pre-initialize pool on startup if database is configured
  if (isDatabaseConfigured()) {
    try {
      app.locals.db = getPool();
    } catch (err) {
      console.warn('[SpendWise API] Database pool could not be initialized at startup:', err.message);
    }
  }

  const serverInstance = app.listen(port, () => {
    console.log(`[SpendWise API] Server running in ${env.NODE_ENV} mode on port ${port}`);
    console.log(`[SpendWise API] Allowed CORS origin: ${env.CLIENT_URL}`);
  });

  const handleShutdown = createShutdownHandler(serverInstance);

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return serverInstance;
}

// Auto-start server only when executed directly as entrypoint (e.g. node src/server.js)
const __filename = fileURLToPath(import.meta.url);
const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]).toLowerCase() === __filename.toLowerCase();

let server = null;
if (isDirectExecution) {
  server = startServer();
}

export { server };
export default server;
