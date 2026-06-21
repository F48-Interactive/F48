import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 * DATABASE_URL is read from process.env (loaded by the deployment environment).
 * For local dev: set DATABASE_URL in .env file.
 *
 * This config is used by:
 *   - prisma migrate deploy (deployment)
 *   - prisma migrate dev (local development)
 *   - prisma generate (client generation)
 */
export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'prisma', 'schema.prisma'),
  migrate: {
    migrations: path.join(import.meta.dirname, 'prisma', 'migrations'),
  },
});
