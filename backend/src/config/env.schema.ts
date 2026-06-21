import { z } from 'zod';

/**
 * Environment variable schema for the F48 backend.
 * Validated at startup — the server will not start with invalid config.
 * No raw `process.env` access outside this module.
 */
export const envSchema = z.object({
  // ── Application ──
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api/v1'),

  // ── Database (PostgreSQL via Prisma) ──
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),

  // ── Redis ──
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection string' }),

  // ── Firebase Admin SDK ──
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1, { message: 'FIREBASE_PRIVATE_KEY is required' }),

  // ── Session / Cookies ──
  SESSION_SECRET: z.string().min(32, { message: 'SESSION_SECRET must be at least 32 characters' }),
  SESSION_MAX_AGE_MS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60 * 1000), // 7 days
  COOKIE_DOMAIN: z.string().optional(),

  // ── Cloudinary ──
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // ── Games Kinbo (Free Fire UID Lookup) ──
  GAMES_KINBO_API_URL: z.string().url().default('https://api.gameskinbo.com'),
  GAMES_KINBO_API_KEY: z.string().min(1),

  // ── YouTube Data API ──
  YOUTUBE_API_KEY: z.string().optional(), // Optional — mock adapter used when absent

  // ── CORS ──
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((val) => val.split(',').map((s) => s.trim())),

  // ── Rate Limiting ──
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // ── Logging ──
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;
