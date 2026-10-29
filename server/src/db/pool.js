import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Process-wide singleton pool instance
let poolInstance = null;

/**
 * Checks whether the DATABASE_URL environment variable is defined and non-empty.
 * Does not instantiate a pool or trigger any network I/O.
 * @returns {boolean}
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Returns true if the singleton PostgreSQL pool has been instantiated.
 * @returns {boolean}
 */
export function isPoolInitialized() {
  return poolInstance !== null;
}

/**
 * Resolves the SSL/TLS configuration object for PostgreSQL pool creation.
 * Enforces strict certificate verification in production.
 *
 * @param {string} connectionString
 * @param {NodeJS.ProcessEnv} [envObj=process.env]
 * @returns {import('pg').ConnectionConfig['ssl'] | false}
 */
export function resolveSslConfig(connectionString, envObj = process.env) {
  const isProduction = envObj.NODE_ENV === 'production';
  const urlLower = (connectionString || '').toLowerCase();
  const urlRequiresSsl =
    urlLower.includes('sslmode=require') ||
    urlLower.includes('sslmode=verify-full') ||
    urlLower.includes('sslmode=verify-ca');

  const isSslNeeded = isProduction || urlRequiresSsl || envObj.DATABASE_SSL === 'true';

  if (!isSslNeeded) {
    return false;
  }

  // RejectUnauthorized: MUST be true in production to prevent MITM attacks.
  // In development/test, rejectUnauthorized defaults to true, but can be explicitly
  // overridden with DATABASE_SSL_REJECT_UNAUTHORIZED='false' if using self-signed dev certificates.
  let rejectUnauthorized = true;
  if (envObj.DATABASE_SSL_REJECT_UNAUTHORIZED !== undefined) {
    if (isProduction && envObj.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
      throw new Error(
        'Disabling TLS certificate verification (DATABASE_SSL_REJECT_UNAUTHORIZED=false) is strictly prohibited in production mode.'
      );
    }
    rejectUnauthorized = envObj.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
  }

  const sslConfig = { rejectUnauthorized };

  if (envObj.DATABASE_SSL_CA) {
    sslConfig.ca = envObj.DATABASE_SSL_CA;
  }

  return sslConfig;
}

/**
 * Creates or retrieves the process-wide PostgreSQL Connection Pool singleton.
 * Database connection is acquired lazily: calling getPool() multiple times returns
 * the exact same Pool instance without instantiating redundant connections.
 *
 * @returns {import('pg').Pool} The singleton PostgreSQL connection pool.
 */
export function getPool() {
  if (poolInstance) {
    return poolInstance;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error(
      'DATABASE_URL environment variable is required to connect to the database.\n' +
      'Please configure DATABASE_URL in server/.env (e.g. from Neon PostgreSQL).'
    );
  }

  const ssl = resolveSslConfig(connectionString, process.env);

  poolInstance = new pg.Pool({
    connectionString,
    ssl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  return poolInstance;
}

/**
 * Gracefully closes the shared PostgreSQL connection pool if it was initialized.
 * Safe to call even if the pool was never initialized.
 * Resets the singleton reference to null.
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (poolInstance) {
    const poolToClose = poolInstance;
    poolInstance = null;
    if (!poolToClose.ended) {
      await poolToClose.end();
    }
  }
}

/**
 * For test isolation only: resets the singleton pool instance without calling end(),
 * or sets a custom/mock pool.
 * @param {import('pg').Pool|null} [mockPool=null]
 */
export function _resetPoolForTesting(mockPool = null) {
  poolInstance = mockPool;
}

