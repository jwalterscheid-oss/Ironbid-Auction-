// drizzle.config.ts
import type { Config } from 'drizzle-kit'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

export default {
  schema: './lib/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: { connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL)! },
  verbose: true,
  strict: false,
} satisfies Config
