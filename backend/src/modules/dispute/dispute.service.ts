/**
 * DisputeService — File, review, and resolve disputes.
 * DISPUTE-001 to DISPUTE-008.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
  ) {}

  /** File a dispute against a match result. */
  async fileDispute(
    user: RequestUser,
    matchResultId: string,
    category: string,
    description: string,
    evidenceAssetIds?: string[],
  ) {
    // Verify match result exists and tournament is in dispute_window
    const result = await this.prisma.matchResult.findUnique({
      where: { id: matchResultId },
      include: { match: { include: { tournament: true } } },
    });
    if (!result) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Match result not found.');
    }
    if (result.match.tournament.status !== 'dispute_window') {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Dispute window is not open.');
    }

    // Verify player was in this match
    const player = await this.prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Player profile required.');
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        matchResultId,
        filedByPlayerId: player.id,
        category: category as any,
        description,
        evidenceAssetIds: evidenceAssetIds ?? [],
        status: 'submitted',
      },
    });

    // Also set match result status to disputed
    await this.prisma.matchResult.update({
      where: { id: matchResultId },
      data: { status: 'disputed' },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: 'player',
      action: 'dispute.filed',
      resourceType: 'dispute',
      resourceId: dispute.id,
      newValue: { matchResultId, category },
    });

    this.logger.log({ disputeId: dispute.id, matchResultId }, 'Dispute filed');
    return dispute;
  }

  /** Admin: transition dispute status. */
  async transitionDispute(
    admin: RequestUser,
    disputeId: string,
    newStatus: string,
    resolution?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Dispute not found.');
    }

    const previousStatus = dispute.status;
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'under_review' && !dispute.adminAssignedId) {
      updateData.adminAssignedId = admin.id;
    }
    if (resolution) {
      updateData.resolution = resolution;
    }
    if (newStatus.startsWith('resolved_')) {
      updateData.resolvedAt = new Date();
    }

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });

    await this.statusHistory.record({
      resourceType: 'dispute',
      resourceId: disputeId,
      previousStatus,
      newStatus,
      actorId: admin.id,
      reason: resolution,
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: admin.role,
      action: `dispute.${newStatus}`,
      resourceType: 'dispute',
      resourceId: disputeId,
      oldValue: { status: previousStatus },
      newValue: { status: newStatus },
      reason: resolution,
    });

    return updated;
  }

  /** List disputes (with filters). */
  async list(filters: { status?: string; tournamentId?: string; page: number; limit: number }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;

    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, total, page: filters.page, limit: filters.limit };
  }

  /** Get dispute by ID. */
  async getById(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Dispute not found.');
    }
    return dispute;
  }

  /** Withdraw dispute (player). */
  async withdraw(user: RequestUser, disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Dispute not found.');
    }

    const player = await this.prisma.player.findUnique({ where: { userId: user.id } });
    if (!player || dispute.filedByPlayerId !== player.id) {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not your dispute.');
    }
    if (!['submitted', 'under_review', 'info_requested'].includes(dispute.status)) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Cannot withdraw.');
    }

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'withdrawn' },
    });
  }
}
