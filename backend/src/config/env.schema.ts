import { z } from 'zod';

const optionalNonEmptyString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(1).optional(),
);

/**
 * Environment variable schema for the F48 backend.
 * Validated at startup. No raw process.env access outside config modules.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api/v1'),

  DATABASE_URL: z
    .string()
    .url({
      message: 'DATABASE_URL must be a valid PostgreSQL connection string',
    }),

  REDIS_URL: z
    .string()
    .url({ message: 'REDIS_URL must be a valid Redis connection string' }),

  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1, { message: 'FIREBASE_PRIVATE_KEY is required' }),

  SESSION_SECRET: z
    .string()
    .min(32, { message: 'SESSION_SECRET must be at least 32 characters' }),
  SESSION_MAX_AGE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60 * 1000),
  COOKIE_DOMAIN: z.string().optional(),
  ROOM_CREDENTIALS_SECRET: z
    .string()
    .min(32, {
      message: 'ROOM_CREDENTIALS_SECRET must be at least 32 characters',
    })
    .optional(),

  GAMES_KINBO_API_URL: z.string().url().default('https://api.gameskinbo.com'),
  GAMES_KINBO_API_KEY: optionalNonEmptyString,

  YOUTUBE_API_KEY: z.string().optional(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://localhost:5173')
    .transform((val) => val.split(',').map((s) => s.trim())),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;
