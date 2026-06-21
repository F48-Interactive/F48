import { Injectable } from '@nestjs/common';
import { envSchema, type EnvConfig } from './env.schema.js';

/**
 * Typed, validated environment configuration service.
 * Parses and validates all env vars at instantiation.
 * No raw `process.env` access should exist outside this class.
 */
@Injectable()
export class EnvService {
  private readonly config: EnvConfig;

  constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      const formatted = result.error.issues
        .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${formatted}`);
    }

    this.config = result.data;
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  get port(): number {
    return this.config.PORT;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.config.REDIS_URL;
  }

  get corsOrigins(): string[] {
    return this.config.CORS_ORIGINS;
  }

  get logLevel(): string {
    return this.config.LOG_LEVEL;
  }

  get sessionSecret(): string {
    return this.config.SESSION_SECRET;
  }

  get roomCredentialsSecret(): string {
    return this.config.ROOM_CREDENTIALS_SECRET ?? this.config.SESSION_SECRET;
  }

  get sessionMaxAgeMs(): number {
    return this.config.SESSION_MAX_AGE_MS;
  }

  get firebaseProjectId(): string {
    return this.config.FIREBASE_PROJECT_ID;
  }

  get firebaseClientEmail(): string {
    return this.config.FIREBASE_CLIENT_EMAIL;
  }

  get firebasePrivateKey(): string {
    return this.config.FIREBASE_PRIVATE_KEY;
  }

  get cloudinaryCloudName(): string {
    return this.config.CLOUDINARY_CLOUD_NAME;
  }

  get cloudinaryApiKey(): string {
    return this.config.CLOUDINARY_API_KEY;
  }

  get cloudinaryApiSecret(): string {
    return this.config.CLOUDINARY_API_SECRET;
  }

  get gamesKinboApiUrl(): string {
    return this.config.GAMES_KINBO_API_URL;
  }

  get gamesKinboApiKey(): string {
    return this.config.GAMES_KINBO_API_KEY;
  }

  get youtubeApiKey(): string | undefined {
    return this.config.YOUTUBE_API_KEY;
  }

  get throttleTtlSeconds(): number {
    return this.config.THROTTLE_TTL_SECONDS;
  }

  get throttleLimit(): number {
    return this.config.THROTTLE_LIMIT;
  }
}
