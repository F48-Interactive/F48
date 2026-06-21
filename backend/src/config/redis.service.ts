import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvService } from './env.service.js';

/**
 * Redis service — managed singleton for caching, pub/sub, rate limiting, and locks.
 * ARCH-003: Redis is NOT the source of truth; PostgreSQL is.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private _client: Redis | null = null;

  constructor(private readonly env: EnvService) {}

  get client(): Redis {
    if (!this._client) {
      throw new Error('Redis client not initialized');
    }
    return this._client;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to Redis...');
    this._client = new Redis(this.env.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        if (times > 10) {
          this.logger.error('Redis: max retries exceeded');
          return null;
        }
        return Math.min(times * 200, 5000);
      },
    });

    this._client.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this._client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this._client) {
      this.logger.log('Disconnecting from Redis...');
      await this._client.quit();
      this.logger.log('Disconnected from Redis');
    }
  }

  /**
   * Health check — attempts a PING command.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
