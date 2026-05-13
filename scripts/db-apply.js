const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { config: loadEnv } = require('dotenv');

loadEnv({ path: '.env.local', override: true });
loadEnv({ override: true });

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set in environment.');
  }

  const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('Missing drizzle/migrations directory. Run npm run db:generate first.');
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migration files found in drizzle/migrations.');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    for (const fileName of files) {
      const filePath = path.join(migrationsDir, fileName);
      const sql = fs.readFileSync(filePath, 'utf8').trim();

      if (!sql) {
        continue;
      }

      console.log(`Applying ${fileName}...`);
      await client.query(sql);
    }

    console.log('All SQL migrations applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
