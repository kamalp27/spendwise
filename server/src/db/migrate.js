import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// PostgreSQL advisory lock ID to serialize concurrent migration runs
const ADVISORY_LOCK_ID = 824901;

/**
 * Reads and returns sorted SQL migration files from the migrations directory.
 */
export function getMigrationFiles(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return files;
}

/**
 * Executes unapplied database migrations sequentially within transactions.
 * @param {import('pg').PoolClient} client - An active PostgreSQL client.
 * @param {string} dir - Directory containing .sql migration files.
 * @returns {Promise<{ applied: string[], skipped: string[] }>}
 */
export async function runMigrations(client, dir = MIGRATIONS_DIR) {
  const applied = [];
  const skipped = [];

  // 1. Acquire PostgreSQL session advisory lock to prevent concurrent runs
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);

  try {
    // 2. Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Fetch already applied migrations
    const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC');
    const appliedSet = new Set(rows.map((r) => r.name));

    // 4. Retrieve migration files in strict ascending order
    const files = getMigrationFiles(dir);

    for (const file of files) {
      if (appliedSet.has(file)) {
        skipped.push(file);
        continue;
      }

      console.log(`[Migrations] Applying: ${file}...`);
      const filePath = path.join(dir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // 5. Execute each migration file inside an atomic transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        console.log(`[Migrations] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] Failed applying ${file}. Transaction rolled back.`);
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    return { applied, skipped };
  } finally {
    // 6. Always release advisory lock
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
  }
}

/**
 * Main execution script when run directly via CLI (npm run migrate)
 */
async function main() {
  console.log('[Migrations] Connecting to PostgreSQL database...');
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { applied, skipped } = await runMigrations(client);
    console.log(`[Migrations] Complete. Applied: ${applied.length}, Already up-to-date: ${skipped.length}`);
  } catch (err) {
    console.error('[Migrations] Migration run failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Auto-run if executed directly via node src/db/migrate.js
if (process.argv[1] === __filename) {
  main();
}
