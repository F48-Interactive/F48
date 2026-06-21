import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Audit Service (ADMIN-011, LIFE-002).
 * Records immutable audit log entries for all significant actions.
 * SEC-005: Never log tokens, passwords, room credentials, API keys, or payout details.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an audit log entry.
   * @param params - Audit log parameters
   */
  async log(params: {
    actorId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          oldValue: params.oldValue as Prisma.InputJsonValue | undefined,
          newValue: params.newValue as Prisma.InputJsonValue | undefined,
          reason: params.reason,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          correlationId: params.correlationId,
        },
      });
    } catch (error) {
      // Audit logging should never crash the request — log and continue
      this.logger.error(
        { error, action: params.action, resourceId: params.resourceId },
        'Failed to write audit log',
      );
    }
  }
}
