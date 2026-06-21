import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { RedisService } from '../../config/redis.service.js';

const CACHE_PREFIX = 'ff:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Feature Flag Service (ADMIN-012).
 * Checks flags from DB with Redis caching.
 * Used by @FeatureGate() guard to gate endpoints.
 */
@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Check if a feature flag is enabled.
   * Checks Redis cache first, falls back to DB.
   */
  async isEnabled(key: string): Promise<boolean> {
    // Check Redis cache
    try {
      const cached = await this.redis.client.get(`${CACHE_PREFIX}${key}`);
      if (cached !== null) {
        return cached === '1';
      }
    } catch {
      // Cache miss or Redis error — fall through to DB
    }

    // Check database
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key },
      select: { value: true },
    });

    const value = flag?.value ?? false;

    // Cache the result
    try {
      await this.redis.client.set(
        `${CACHE_PREFIX}${key}`,
        value ? '1' : '0',
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Non-critical — continue without cache
    }

    return value;
  }

  /**
   * Set a feature flag value (admin operation).
   */
  async setFlag(
    key: string,
    value: boolean,
    updatedBy: string,
  ): Promise<void> {
    await this.prisma.featureFlag.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, updatedBy },
    });

    // Invalidate cache
    try {
      await this.redis.client.del(`${CACHE_PREFIX}${key}`);
    } catch {
      this.logger.warn(`Failed to invalidate cache for flag: ${key}`);
    }
  }

  /**
   * Get all feature flags (admin dashboard).
   */
  async getAllFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }
}
