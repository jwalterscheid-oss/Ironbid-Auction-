// Applies a single SQL migration file by name.
// Usage: node scripts/db-apply-file.js 0001_marketplace_corrections.sql
// Unlike db-apply.js (which runs every file), this targets one migration —
// useful when earlier migrations are not idempotent and must not be re-run.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { config: loadEnv } = require('dotenv');

loadEnv({ path: '.env.local', override: true });
loadEnv({ override: true });

async function main() {
  const fileName = process.argv[2];
  if (!fileName) {
    throw new Error('Usage: node scripts/db-apply-file.js <migration-file.sql>');
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set in environment.');
  }

  const filePath = path.join(process.cwd(), 'drizzle', 'migrations', fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!sql) {
    console.log(`${fileName} is empty; nothing to apply.`);
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log(`Applying ${fileName}...`);
    await client.query(sql);
    console.log(`Applied ${fileName} successfully.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
