import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMigrationFiles, runMigrations } from '../src/db/migrate.js';
import { PREDEFINED_CATEGORIES, DEV_USER } from '../src/db/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations');

describe('Database Schema & Migration System', () => {
  describe('Migration File Ordering & Structure', () => {
    it('should find all expected migration files in strict sequential order', () => {
      const files = getMigrationFiles(MIGRATIONS_DIR);

      expect(files.length).toBe(6);
      expect(files).toEqual([
        '001_create_schema_migrations.sql',
        '002_create_users_table.sql',
        '003_create_categories_table.sql',
        '004_create_expenses_table.sql',
        '005_create_budgets_table.sql',
        '006_add_auth_and_sessions.sql'
      ]);

      // Verify naming convention: 3 digits followed by underscore and lowercase name
      files.forEach((file) => {
        expect(file).toMatch(/^\d{3}_[a-z0-9_]+\.sql$/);
      });
    });

    it('should verify schema constraints and types in migration files', () => {
      // 002 Users table
      const usersSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '002_create_users_table.sql'), 'utf8');
      expect(usersSql).toContain('gen_random_uuid()');
      expect(usersSql).toContain('idx_users_email_lower');
      expect(usersSql).toContain("'INR'");

      // 003 Categories table
      const categoriesSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '003_create_categories_table.sql'), 'utf8');
      expect(categoriesSql).toContain('chk_categories_scope');
      expect(categoriesSql).toContain('idx_categories_global_name_lower');
      expect(categoriesSql).toContain('idx_categories_user_name_lower');

      // 004 Expenses table
      const expensesSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '004_create_expenses_table.sql'), 'utf8');
      expect(expensesSql).toContain('NUMERIC(12, 2)');
      expect(expensesSql).not.toContain('FLOAT');
      expect(expensesSql).not.toContain('REAL');
      expect(expensesSql).toContain('chk_expenses_amount_positive');
      expect(expensesSql).toContain('chk_expenses_payment_method');
      expect(expensesSql).toContain('ON DELETE RESTRICT');
      expect(expensesSql).toContain('ON DELETE SET NULL');

      // 005 Budgets table
      const budgetsSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '005_create_budgets_table.sql'), 'utf8');
      expect(budgetsSql).toContain('NUMERIC(12, 2)');
      expect(budgetsSql).toContain('idx_budgets_user_overall');
      expect(budgetsSql).toContain('WHERE category_id IS NULL');
      expect(budgetsSql).toContain('idx_budgets_user_category');
      expect(budgetsSql).toContain('WHERE category_id IS NOT NULL');

      // 006 Auth and Sessions table
      const authSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '006_add_auth_and_sessions.sql'), 'utf8');
      expect(authSql).toContain('password_hash VARCHAR(255)');
      expect(authSql).toContain('is_active BOOLEAN NOT NULL DEFAULT TRUE');
      expect(authSql).toContain('last_login_at TIMESTAMPTZ');
      expect(authSql).toContain('CREATE TABLE IF NOT EXISTS user_sessions');
      expect(authSql).toContain('REFERENCES users(id) ON DELETE CASCADE');
      expect(authSql).toContain('idx_user_sessions_expire');
      expect(authSql).toContain('idx_user_sessions_user_id');
    });
  });

  describe('Migration Runner Logic (Mock Client)', () => {
    it('should apply all unapplied migrations within transactions and release advisory lock', async () => {
      const executedQueries = [];
      const mockClient = {
        query: vi.fn(async (sql, params) => {
          executedQueries.push({ sql: sql.trim(), params });
          if (sql.includes('SELECT name FROM schema_migrations')) {
            return { rows: [] }; // No migrations applied yet
          }
          return { rows: [] };
        })
      };

      const result = await runMigrations(mockClient, MIGRATIONS_DIR);

      expect(result.applied.length).toBe(6);
      expect(result.skipped.length).toBe(0);

      // Verify advisory lock acquired and released
      expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_lock($1)', [824901]);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [824901]);

      // Verify transactions used for migrations
      const begins = executedQueries.filter((q) => q.sql === 'BEGIN');
      const commits = executedQueries.filter((q) => q.sql === 'COMMIT');
      expect(begins.length).toBe(6);
      expect(commits.length).toBe(6);
    });

    it('should skip migrations that are already marked as applied', async () => {
      const alreadyApplied = [
        '001_create_schema_migrations.sql',
        '002_create_users_table.sql'
      ];

      const mockClient = {
        query: vi.fn(async (sql) => {
          if (sql.includes('SELECT name FROM schema_migrations')) {
            return { rows: alreadyApplied.map((name) => ({ name })) };
          }
          return { rows: [] };
        })
      };

      const result = await runMigrations(mockClient, MIGRATIONS_DIR);

      expect(result.skipped).toEqual(alreadyApplied);
      expect(result.applied).toEqual([
        '003_create_categories_table.sql',
        '004_create_expenses_table.sql',
        '005_create_budgets_table.sql',
        '006_add_auth_and_sessions.sql'
      ]);
    });

    it('should roll back and throw error without marking failed migration as applied', async () => {
      let failOnInsert = false;
      const executed = [];

      const mockClient = {
        query: vi.fn(async (sql, params) => {
          executed.push(sql.trim());
          if (sql.includes('SELECT name FROM schema_migrations')) {
            return { rows: [] };
          }
          if (sql.includes('002_create_users_table.sql') || sql.includes('CREATE TABLE IF NOT EXISTS users')) {
            failOnInsert = true;
          }
          if (failOnInsert && sql.startsWith('INSERT INTO schema_migrations')) {
            throw new Error('Database constraint violation simulation');
          }
          return { rows: [] };
        })
      };

      await expect(runMigrations(mockClient, MIGRATIONS_DIR)).rejects.toThrow(
        /Migration 002_create_users_table\.sql failed/
      );

      // Verify ROLLBACK was executed
      expect(executed).toContain('ROLLBACK');

      // Verify lock was still released in finally block
      expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [824901]);
    });
  });

  describe('Seed Data Integrity & Safety', () => {
    it('should define non-real development user and predefined categories without personal data', () => {
      expect(DEV_USER.email).toBe('dev.user@spendwise.example');
      expect(DEV_USER.currency).toBe('INR');

      expect(PREDEFINED_CATEGORIES.length).toBeGreaterThanOrEqual(8);
      const categoryNames = PREDEFINED_CATEGORIES.map((c) => c.name);
      expect(categoryNames).toContain('Food & Dining');
      expect(categoryNames).toContain('Transport');
      expect(categoryNames).toContain('Shopping');
      expect(categoryNames).toContain('Bills & Utilities');
      expect(categoryNames).toContain('Health & Medical');
      expect(categoryNames).toContain('Education');
      expect(categoryNames).toContain('Entertainment');
      expect(categoryNames).toContain('Other');

      // Verify each category has name, icon, and hex color
      PREDEFINED_CATEGORIES.forEach((cat) => {
        expect(cat.name).toBeTruthy();
        expect(cat.icon).toBeTruthy();
        expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });
});
