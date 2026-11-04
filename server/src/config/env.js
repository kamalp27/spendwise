import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables from .env file if available
dotenv.config();

export function getEnvConfig(envSource = process.env) {
  const nodeEnv = envSource.NODE_ENV || 'development';
  const allowedEnvs = ['development', 'production', 'test'];
  if (!allowedEnvs.includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV "${nodeEnv}". Must be one of: ${allowedEnvs.join(', ')}`
    );
  }

  const portRaw = envSource.PORT || '5000';
  const port = parseInt(portRaw, 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT "${portRaw}". Must be a valid TCP port number (1-65535).`);
  }

  const clientUrlRaw = envSource.CLIENT_URL || (nodeEnv === 'production' ? '' : 'http://localhost:5173');
  if (nodeEnv === 'production' && !clientUrlRaw) {
    throw new Error('CLIENT_URL environment variable is required in production mode.');
  }

  let clientUrl = '';
  let clientUrls = [];

  if (clientUrlRaw) {
    if (clientUrlRaw.includes('*')) {
      throw new Error('CLIENT_URL cannot contain wildcard ("*") characters.');
    }

    const rawList = clientUrlRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (rawList.length === 0 && nodeEnv === 'production') {
      throw new Error('CLIENT_URL environment variable is required in production mode.');
    }

    clientUrls = rawList.map((entry) => {
      try {
        const parsedUrl = new URL(entry);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error(`CLIENT_URL must use http or https protocol. Got "${parsedUrl.protocol}"`);
        }
        return entry.replace(/\/+$/, '');
      } catch (err) {
        throw new Error(`Invalid CLIENT_URL "${entry}": ${err.message}`);
      }
    });

    clientUrl = clientUrls[0] || '';
  }

  const rateLimitWindowMsRaw = envSource.RATE_LIMIT_WINDOW_MS || '900000';
  const rateLimitWindowMs = parseInt(rateLimitWindowMsRaw, 10);
  if (Number.isNaN(rateLimitWindowMs) || rateLimitWindowMs <= 0) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be a positive integer.');
  }

  const rateLimitMaxRaw = envSource.RATE_LIMIT_MAX || '100';
  const rateLimitMax = parseInt(rateLimitMaxRaw, 10);
  if (Number.isNaN(rateLimitMax) || rateLimitMax <= 0) {
    throw new Error('RATE_LIMIT_MAX must be a positive integer.');
  }

  let sessionSecret = envSource.SESSION_SECRET;
  if (!sessionSecret) {
    if (nodeEnv === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production mode.');
    }
    if (nodeEnv === 'test') {
      sessionSecret = 'test_session_secret_deterministic_at_least_32_characters_long';
    } else {
      // In development, generate an ephemeral cryptographically strong secret per process
      // to avoid static known secrets in shared or non-isolated runtimes.
      sessionSecret = crypto.randomBytes(32).toString('hex');
    }
  }

  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }

  if (nodeEnv === 'production') {
    const disallowedPlaceholderSecrets = [
      'your_secure_random_hex_string_at_least_32_characters_long',
      'your_secure_random_hex_string_here',
      '12345678901234567890123456789012'
    ];
    if (disallowedPlaceholderSecrets.includes(sessionSecret)) {
      throw new Error('SESSION_SECRET cannot use default or example template values in production mode.');
    }
  }

  const sessionMaxAgeMsRaw = envSource.SESSION_MAX_AGE_MS || '604800000'; // 7 days default
  const sessionMaxAgeMs = parseInt(sessionMaxAgeMsRaw, 10);
  if (Number.isNaN(sessionMaxAgeMs) || sessionMaxAgeMs <= 0) {
    throw new Error('SESSION_MAX_AGE_MS must be a positive integer.');
  }

  const sessionCookieName = envSource.SESSION_COOKIE_NAME || 'spendwise.sid';
  
  const rawSameSite = envSource.COOKIE_SAME_SITE || 'lax';
  const cookieSameSite = String(rawSameSite).toLowerCase();
  const allowedSameSites = ['lax', 'strict', 'none'];
  if (!allowedSameSites.includes(cookieSameSite)) {
    throw new Error(
      `Invalid COOKIE_SAME_SITE "${rawSameSite}". Allowed values: ${allowedSameSites.join(', ')}.`
    );
  }

  let trustProxy;
  const rawTrustProxy =
    envSource.TRUST_PROXY !== undefined ? String(envSource.TRUST_PROXY).trim() : '';

  if (rawTrustProxy.length > 0) {
    const lower = rawTrustProxy.toLowerCase();
    if (lower === 'true') {
      trustProxy = true;
    } else if (lower === 'false') {
      trustProxy = false;
    } else if (/^-?\d+$/.test(rawTrustProxy)) {
      trustProxy = parseInt(rawTrustProxy, 10);
      if (trustProxy < 0) {
        throw new Error('TRUST_PROXY cannot be a negative integer.');
      }
    } else if (!Number.isNaN(Number(rawTrustProxy))) {
      throw new Error(`Invalid TRUST_PROXY hop count "${rawTrustProxy}". Hop count must be an integer.`);
    } else {
      trustProxy = rawTrustProxy;
    }
  } else {
    // Render and modern PaaS deploy behind an ingress reverse proxy.
    // Default to 1 (single reverse proxy hop) in production, false otherwise.
    trustProxy = nodeEnv === 'production' ? 1 : false;
  }

  return Object.freeze({
    NODE_ENV: nodeEnv,
    PORT: port,
    CLIENT_URL: clientUrl,
    CLIENT_URLS: Object.freeze(clientUrls),
    RATE_LIMIT_WINDOW_MS: rateLimitWindowMs,
    RATE_LIMIT_MAX: rateLimitMax,
    SESSION_SECRET: sessionSecret,
    SESSION_MAX_AGE_MS: sessionMaxAgeMs,
    SESSION_COOKIE_NAME: sessionCookieName,
    COOKIE_SAME_SITE: cookieSameSite,
    TRUST_PROXY: trustProxy,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    isDevelopment: nodeEnv === 'development'
  });
}

export const env = getEnvConfig();
