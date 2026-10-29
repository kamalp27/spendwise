import { describe, it, expect } from 'vitest';
import http from 'http';
import express from 'express';
import { resolveSslConfig } from '../src/db/pool.js';
import { getEnvConfig } from '../src/config/env.js';
import { createApp } from '../src/app.js';

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

  describe('3. Production Reverse Proxy Trust Configuration (Render / PaaS)', () => {
    const validDevEnv = {
      NODE_ENV: 'development',
      PORT: '5000',
      CLIENT_URL: 'http://localhost:5173',
      SESSION_SECRET: '0123456789012345678901234567890123456789'
    };

    it('defaults TRUST_PROXY to 1 in production mode when not explicitly configured', () => {
      const prodEnv = getEnvConfig({
        NODE_ENV: 'production',
        PORT: '5000',
        CLIENT_URL: 'https://spendwise.app',
        SESSION_SECRET: 'a_very_strong_custom_production_session_secret_123456789'
      });
      expect(prodEnv.TRUST_PROXY).toBe(1);
    });

    it('defaults TRUST_PROXY to false in development and test environments', () => {
      const devEnv = getEnvConfig(validDevEnv);
      expect(devEnv.TRUST_PROXY).toBe(false);

      const testEnv = getEnvConfig({ ...validDevEnv, NODE_ENV: 'test' });
      expect(testEnv.TRUST_PROXY).toBe(false);
    });

    it('treats empty or whitespace-only TRUST_PROXY as unconfigured and falls back to default', () => {
      const prodEnv = getEnvConfig({
        NODE_ENV: 'production',
        PORT: '5000',
        CLIENT_URL: 'https://spendwise.app',
        SESSION_SECRET: 'a_very_strong_custom_production_session_secret_123456789',
        TRUST_PROXY: '   '
      });
      expect(prodEnv.TRUST_PROXY).toBe(1);

      const devEnv = getEnvConfig({ ...validDevEnv, TRUST_PROXY: '   ' });
      expect(devEnv.TRUST_PROXY).toBe(false);
    });

    it('parses explicit integer TRUST_PROXY values', () => {
      const config = getEnvConfig({ ...validDevEnv, TRUST_PROXY: '2' });
      expect(config.TRUST_PROXY).toBe(2);

      const zeroConfig = getEnvConfig({ ...validDevEnv, TRUST_PROXY: '0' });
      expect(zeroConfig.TRUST_PROXY).toBe(0);
    });

    it('rejects negative integer TRUST_PROXY values', () => {
      expect(() => {
        getEnvConfig({ ...validDevEnv, TRUST_PROXY: '-1' });
      }).toThrow(/TRUST_PROXY cannot be a negative integer/);
    });

    it('rejects floating-point hop count values', () => {
      expect(() => {
        getEnvConfig({ ...validDevEnv, TRUST_PROXY: '1.5' });
      }).toThrow(/Invalid TRUST_PROXY hop count "1.5"\. Hop count must be an integer\./);
    });

    it('parses explicit boolean TRUST_PROXY values', () => {
      expect(getEnvConfig({ ...validDevEnv, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
      expect(getEnvConfig({ ...validDevEnv, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    });

    it('preserves custom string TRUST_PROXY values (e.g. subnet or loopback)', () => {
      const config = getEnvConfig({ ...validDevEnv, TRUST_PROXY: 'loopback' });
      expect(config.TRUST_PROXY).toBe('loopback');
    });

    it('configures Express trust proxy setting correctly when trustProxy: 1 is provided', () => {
      const app = createApp({ trustProxy: 1 });
      expect(app.get('trust proxy')).toBe(1);
    });

    it('leaves Express trust proxy as false when trustProxy: false is provided', () => {
      const app = createApp({ trustProxy: false });
      expect(app.get('trust proxy')).toBe(false);
    });

    it('safely extracts client IP from X-Forwarded-For with 1 trusted proxy hop and ignores upstream spoofed IPs', async () => {
      const app = express();
      app.set('trust proxy', 1);
      let capturedIp = null;
      let capturedSecure = null;

      app.get('/test-proxy-ip', (req, res) => {
        capturedIp = req.ip;
        capturedSecure = req.secure;
        res.status(200).json({ ok: true });
      });

      await new Promise((resolve) => {
        const req = new http.IncomingMessage();
        req.method = 'GET';
        req.url = '/test-proxy-ip';
        req.headers = {
          host: 'localhost:5000',
          'x-forwarded-for': '198.51.100.1, 203.0.113.195', // 198.51.100.1 is upstream/spoofed; 203.0.113.195 is real client
          'x-forwarded-proto': 'https'
        };
        req.socket = { remoteAddress: '10.0.0.1' }; // Immediate proxy address (e.g. Render load balancer)

        const res = new http.ServerResponse(req);
        res.end = () => resolve();
        app.handle(req, res);
      });

      // Express with trust proxy: 1 trusts 1 hop from the socket (10.0.0.1), resolving to 203.0.113.195
      expect(capturedIp).toBe('203.0.113.195');
      expect(capturedSecure).toBe(true);
    });
  });
});
