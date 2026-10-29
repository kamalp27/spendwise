import { describe, it, expect } from 'vitest';
import { resolveSslConfig } from '../src/db/pool.js';
import { getEnvConfig } from '../src/config/env.js';

describe('Stage 6.2D7 — Production Security Hardening', () => {
  describe('1. PostgreSQL TLS / SSL Configuration Hardening', () => {
    it('returns false for local non-SSL connection strings in development', () => {
      const ssl = resolveSslConfig('postgresql://user:pass@localhost:5432/spendwise', {
        NODE_ENV: 'development'
      });
      expect(ssl).toBe(false);
    });

    it('enforces rejectUnauthorized: true when sslmode=require is in the database URL', () => {
      const ssl = resolveSslConfig(
        'postgresql://user:pass@ep-example.neon.tech/neondb?sslmode=require',
        { NODE_ENV: 'development' }
      );
      expect(ssl).toEqual({ rejectUnauthorized: true });
    });

    it('enforces rejectUnauthorized: true when sslmode=verify-full is in the database URL', () => {
      const ssl = resolveSslConfig(
        'postgresql://user:pass@ep-example.neon.tech/neondb?sslmode=verify-full',
        { NODE_ENV: 'development' }
      );
      expect(ssl).toEqual({ rejectUnauthorized: true });
    });

    it('enforces rejectUnauthorized: true in production mode even if connection string lacks sslmode', () => {
      const ssl = resolveSslConfig('postgresql://user:pass@db.internal:5432/spendwise', {
        NODE_ENV: 'production'
      });
      expect(ssl).toEqual({ rejectUnauthorized: true });
    });

    it('strictly prohibits disabling certificate verification in production mode', () => {
      expect(() => {
        resolveSslConfig('postgresql://user:pass@ep-example.neon.tech/neondb?sslmode=require', {
          NODE_ENV: 'production',
          DATABASE_SSL_REJECT_UNAUTHORIZED: 'false'
        });
      }).toThrow(/Disabling TLS certificate verification.*is strictly prohibited in production mode/);
    });

    it('allows explicit certificate verification bypass only in non-production environments when configured', () => {
      const ssl = resolveSslConfig(
        'postgresql://user:pass@localhost:5432/spendwise?sslmode=require',
        {
          NODE_ENV: 'development',
          DATABASE_SSL_REJECT_UNAUTHORIZED: 'false'
        }
      );
      expect(ssl).toEqual({ rejectUnauthorized: false });
    });

    it('attaches custom root CA bundle when DATABASE_SSL_CA is provided', () => {
      const mockCaCert = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
      const ssl = resolveSslConfig(
        'postgresql://user:pass@ep-example.neon.tech/neondb?sslmode=require',
        {
          NODE_ENV: 'production',
          DATABASE_SSL_CA: mockCaCert
        }
      );
      expect(ssl).toEqual({
        rejectUnauthorized: true,
        ca: mockCaCert
      });
    });
  });

  describe('2. Environment & Session Security Validation', () => {
    const validDevEnv = {
      NODE_ENV: 'development',
      PORT: '5000',
      CLIENT_URL: 'http://localhost:5173',
      SESSION_SECRET: '0123456789012345678901234567890123456789'
    };

    it('validates a correct production environment configuration', () => {
      const prodEnv = getEnvConfig({
        NODE_ENV: 'production',
        PORT: '5000',
        CLIENT_URL: 'https://spendwise.app',
        SESSION_SECRET: 'a_very_strong_custom_production_session_secret_123456789',
        COOKIE_SAME_SITE: 'lax'
      });

      expect(prodEnv.isProduction).toBe(true);
      expect(prodEnv.CLIENT_URL).toBe('https://spendwise.app');
      expect(prodEnv.COOKIE_SAME_SITE).toBe('lax');
    });

    it('throws error when CLIENT_URL is missing in production mode', () => {
      expect(() => {
        getEnvConfig({
          NODE_ENV: 'production',
          PORT: '5000',
          CLIENT_URL: '',
          SESSION_SECRET: 'a_very_strong_custom_production_session_secret_123456789'
        });
      }).toThrow(/CLIENT_URL environment variable is required in production mode/);
    });

    it('rejects CLIENT_URL containing wildcard characters', () => {
      expect(() => {
        getEnvConfig({
          ...validDevEnv,
          CLIENT_URL: '*'
        });
      }).toThrow(/CLIENT_URL cannot contain wildcard/);
    });

    it('rejects CLIENT_URL with invalid protocols (e.g. javascript: or ftp:)', () => {
      expect(() => {
        getEnvConfig({
          ...validDevEnv,
          CLIENT_URL: 'ftp://localhost:5173'
        });
      }).toThrow(/CLIENT_URL must use http or https protocol/);
    });

    it('throws error when SESSION_SECRET is missing in production mode', () => {
      expect(() => {
        getEnvConfig({
          NODE_ENV: 'production',
          PORT: '5000',
          CLIENT_URL: 'https://spendwise.app',
          SESSION_SECRET: ''
        });
      }).toThrow(/SESSION_SECRET environment variable is required in production mode/);
    });

    it('throws error when SESSION_SECRET is under 32 characters', () => {
      expect(() => {
        getEnvConfig({
          ...validDevEnv,
          SESSION_SECRET: 'short_secret_under_32_chars'
        });
      }).toThrow(/SESSION_SECRET must be at least 32 characters long/);
    });

    it('rejects example/placeholder SESSION_SECRET in production mode', () => {
      expect(() => {
        getEnvConfig({
          NODE_ENV: 'production',
          PORT: '5000',
          CLIENT_URL: 'https://spendwise.app',
          SESSION_SECRET: 'your_secure_random_hex_string_at_least_32_characters_long'
        });
      }).toThrow(/SESSION_SECRET cannot use default or example template values in production mode/);
    });

    it('rejects invalid COOKIE_SAME_SITE values', () => {
      expect(() => {
        getEnvConfig({
          ...validDevEnv,
          COOKIE_SAME_SITE: 'unsupported_mode'
        });
      }).toThrow(/Invalid COOKIE_SAME_SITE/);
    });

    it('accepts valid COOKIE_SAME_SITE options: lax, strict, none', () => {
      ['lax', 'strict', 'none'].forEach((mode) => {
        const config = getEnvConfig({
          ...validDevEnv,
          COOKIE_SAME_SITE: mode
        });
        expect(config.COOKIE_SAME_SITE).toBe(mode);
      });
    });
  });
});
