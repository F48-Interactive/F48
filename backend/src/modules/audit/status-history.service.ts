import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';

/**
 * Status History Service (LIFE-002).
 * Records every state transition for any resource type.
 * Used alongside the state machine for full audit trail.
 */
@Injectable()
export class StatusHistoryService {
  private readonly logger = new Logger(StatusHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a status transition.
   */
  async record(params: {
    resourceType: string;
    resourceId: string;
    previousStatus: string;
    newStatus: string;
    actorId: string;
    reason?: string;
  }): Promise<void> {
    try {
      await this.prisma.statusHistory.create({
        data: {
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          previousStatus: params.previousStatus,
          newStatus: params.newStatus,
          actorId: params.actorId,
          reason: params.reason,
        },
      });
    } catch (error) {
      // Status history logging should never crash the request
      this.logger.error(
        {
          error,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
        },
        'Failed to record status history',
      );
    }
  }

  /**
   * Get the full status history for a resource.
   */
  async getHistory(
    resourceType: string,
    resourceId: string,
  ) {
    return this.prisma.statusHistory.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
