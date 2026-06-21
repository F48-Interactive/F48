/**
 * DisputeService — File, review, and resolve disputes.
 * DISPUTE-001 to DISPUTE-008.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import {
  DisputeAuthorityService,
  OPEN_DISPUTE_STATUSES,
} from '../../domain/dispute-authority.service.js';

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
    private readonly authority: DisputeAuthorityService,
  ) {}

  /** File a dispute against a match result. */
  async fileDispute(
    user: RequestUser,
    matchResultId: string,
    category: string,
    description: string,
    evidenceAssetIds?: string[],
  ) {
    const disputeCategory = this.authority.assertCategory(category);
    const safeEvidenceAssetIds = evidenceAssetIds ?? [];
    const { player } = await this.authority.getFilingContext(
      user,
      matchResultId,
    );
    await this.authority.assertEvidenceAssets(user, safeEvidenceAssetIds);

    const dispute = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;

      const created = await db.dispute.create({
        data: {
          matchResultId,
          filedByPlayerId: player.id,
          category: disputeCategory,
          description,
          evidenceAssetIds: safeEvidenceAssetIds,
          status: 'submitted',
        },
      });

      await db.matchResult.update({
        where: { id: matchResultId },
        data: { status: 'disputed' },
      });

      return created;
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'dispute.filed',
      resourceType: 'dispute',
      resourceId: dispute.id,
      newValue: { matchResultId, category: disputeCategory },
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
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Dispute not found.',
      );
    }

    const previousStatus = dispute.status;
    const nextStatus = this.authority.assertTransition(
      previousStatus,
      newStatus,
      resolution,
    );
    const updateData: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'under_review' && !dispute.adminAssignedId) {
      updateData.adminAssignedId = admin.id;
    }
    if (resolution) {
      updateData.resolution = resolution;
    }
    if (nextStatus.startsWith('resolved_')) {
      updateData.resolvedAt = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      const saved = await db.dispute.update({
        where: { id: disputeId },
        data: updateData,
      });

      const resultStatus =
        this.authority.nextResultStatusAfterDispute(nextStatus);
      if (resultStatus) {
        const openDisputes = await db.dispute.count({
          where: {
            matchResultId: dispute.matchResultId,
            id: { not: disputeId },
            status: { in: [...OPEN_DISPUTE_STATUSES] },
          },
        });
        if (openDisputes === 0) {
          await db.matchResult.update({
            where: { id: dispute.matchResultId },
            data: { status: resultStatus },
          });
        }
      }

      return saved;
    });

    await this.statusHistory.record({
      resourceType: 'dispute',
      resourceId: disputeId,
      previousStatus,
      newStatus: nextStatus,
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
      newValue: { status: nextStatus },
      reason: resolution,
    });

    return updated;
  }

  /** List disputes (with filters). */
  async list(filters: {
    status?: string;
    tournamentId?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.DisputeWhereInput = {};
    if (filters.status)
      where.status = this.authority.assertStatus(filters.status);
    if (filters.tournamentId) {
      const matchResults = await this.prisma.matchResult.findMany({
        where: { match: { tournamentId: filters.tournamentId } },
        select: { id: true },
      });
      where.matchResultId = {
        in: matchResults.map((result: { id: string }) => result.id),
      };
    }

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
  async getById(user: RequestUser, disputeId: string) {
    return this.authority.getDisputeForUser(disputeId, user);
  }

  /** Withdraw dispute (player). */
  async withdraw(user: RequestUser, disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Dispute not found.',
      );
    }

    const player = await this.prisma.player.findUnique({
      where: { userId: user.id },
    });
    if (!player || dispute.filedByPlayerId !== player.id) {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not your dispute.');
    }
    const nextStatus = this.authority.assertTransition(
      dispute.status,
      'withdrawn',
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      const saved = await db.dispute.update({
        where: { id: disputeId },
        data: { status: nextStatus },
      });

      const openDisputes = await db.dispute.count({
        where: {
          matchResultId: dispute.matchResultId,
          id: { not: disputeId },
          status: { in: [...OPEN_DISPUTE_STATUSES] },
        },
      });
      if (openDisputes === 0) {
        await db.matchResult.update({
          where: { id: dispute.matchResultId },
          data: { status: 'provisional' },
        });
      }

      return saved;
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'dispute.withdrawn',
      resourceType: 'dispute',
      resourceId: disputeId,
      oldValue: { status: dispute.status },
      newValue: { status: nextStatus },
    });

    await this.statusHistory.record({
      resourceType: 'dispute',
      resourceId: disputeId,
      previousStatus: dispute.status,
      newStatus: nextStatus,
      actorId: user.id,
      reason: 'Withdrawn by filer.',
    });

    return updated;
  }
}
