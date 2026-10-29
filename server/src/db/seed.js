import { fileURLToPath } from 'url';
import { getPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Standard predefined global categories for personal expense tracking.
 * All have is_predefined = true and user_id = null.
 */
export const PREDEFINED_CATEGORIES = [
  { name: 'Food & Dining', icon: 'utensils', color: '#EF4444' },
  { name: 'Transport', icon: 'car', color: '#F97316' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#F59E0B' },
  { name: 'Bills & Utilities', icon: 'receipt', color: '#10B981' },
  { name: 'Health & Medical', icon: 'heart-pulse', color: '#06B6D4' },
  { name: 'Education', icon: 'graduation-cap', color: '#3B82F6' },
  { name: 'Entertainment', icon: 'film', color: '#8B5CF6' },
  { name: 'Other', icon: 'tag', color: '#6B7280' }
];

/**
 * Default development user profile.
 * IMPORTANT: This record is for development data modeling only and does NOT
 * provide authentication, access control, or password verification.
 */
export const DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev.user@spendwise.example',
  displayName: 'Dev User',
  currency: 'INR'
};

/**
 * Seeds the development user and global predefined categories.
 * All queries are strictly idempotent (safe to run repeatedly).
 * @param {import('pg').PoolClient} client
 */
export async function runSeed(client) {
  console.log('[Seed] Seeding development user profile...');

  // 1. Seed Development User (idempotent via LOWER(email) unique index)
  await client.query(
    `
    INSERT INTO users (id, email, display_name, currency)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ((LOWER(email))) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        currency = EXCLUDED.currency
    RETURNING id, email, display_name, currency;
  `,
    [DEV_USER.id, DEV_USER.email, DEV_USER.displayName, DEV_USER.currency]
  );

  console.log(`[Seed] Development user confirmed: ${DEV_USER.email} (${DEV_USER.currency})`);

  // 2. Seed Predefined Global Categories (idempotent via LOWER(name) partial index)
  console.log('[Seed] Seeding global predefined categories...');
  for (const cat of PREDEFINED_CATEGORIES) {
    await client.query(
      `
      INSERT INTO categories (name, icon, color, is_predefined, user_id)
      VALUES ($1, $2, $3, TRUE, NULL)
      ON CONFLICT ((LOWER(name))) WHERE user_id IS NULL DO UPDATE
      SET icon = EXCLUDED.icon,
          color = EXCLUDED.color
      RETURNING id, name;
    `,
      [cat.name, cat.icon, cat.color]
    );
  }

  console.log(`[Seed] Predefined categories seeded (${PREDEFINED_CATEGORIES.length} categories).`);
}

/**
 * Main execution script when run directly via CLI (npm run seed)
 */
async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_SEED) {
    console.error(
      '[Seed] Refusing to seed database in production environment.\n' +
      'Development seed data must not be loaded into production.\n' +
      'Set ALLOW_PROD_SEED=true to override explicitly.'
    );
    process.exit(1);
  }

  console.log('[Seed] Connecting to PostgreSQL database...');
  const pool = getPool();
  const client = await pool.connect();

  try {
    await runSeed(client);
    console.log('[Seed] Database seeding completed successfully.');
  } catch (err) {
    console.error('[Seed] Seeding failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Auto-run if executed directly via node src/db/seed.js
if (process.argv[1] === __filename) {
  main();
}
