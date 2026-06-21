import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../config/database.service.js';
import { RedisService } from '../../config/redis.service.js';
import { Public } from '../../common/decorators/index.js';

interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    database: { status: 'up' | 'down' };
    redis: { status: 'up' | 'down' };
  };
}

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness check — is the server running?
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness health check' })
  @ApiResponse({ status: 200, description: 'Server is alive' })
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check — is the server ready to serve traffic?
   * Checks DB and Redis connectivity.
   */
  @Public()
  @Get('readiness')
  @ApiOperation({ summary: 'Readiness check (DB + Redis)' })
  @ApiResponse({ status: 200, description: 'All services healthy' })
  @ApiResponse({ status: 503, description: 'One or more services unhealthy' })
  async getReadiness(): Promise<HealthCheckResult> {
    const [dbHealthy, redisHealthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const allHealthy = dbHealthy && redisHealthy;

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: dbHealthy ? 'up' : 'down' },
        redis: { status: redisHealthy ? 'up' : 'down' },
      },
    };
  }
}
