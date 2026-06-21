/**
 * AdminService — Admin moderation: suspend/ban, FF unbind, tournament void.
 * ADMIN-001 to ADMIN-011, PLAYER-008 (admin-only FF unbind).
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';

const ACTIVE_TOURNAMENT_STATUSES = [
  'published',
  'registration_open',
  'registration_closed',
  'check_in',
  'live',
  'provisional_results',
  'dispute_window',
  'results_final',
] as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
  ) {}

  /** Suspend/ban a user (ADMIN-003/004). */
  async moderateUser(
    admin: RequestUser,
    userId: string,
    action: 'suspend' | 'ban' | 'reinstate',
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'User not found.');

    const previousStatus = user.status;
    const newStatus =
      action === 'reinstate'
        ? 'active'
        : action === 'suspend'
          ? 'suspended'
          : 'banned';

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });

    // Also update player/organizer status if exists
    await this.prisma.player.updateMany({
      where: { userId },
      data: {
        status:
          action === 'reinstate'
            ? 'active'
            : action === 'suspend'
              ? 'suspended'
              : 'banned',
      },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId: admin.id,
        action: `user.${action}`,
        targetType: 'user',
        targetId: userId,
        reason,
      },
    });

    await this.statusHistory.record({
      resourceType: 'user',
      resourceId: userId,
      previousStatus,
      newStatus,
      actorId: admin.id,
      reason,
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: admin.role,
      action: `admin.user.${action}`,
      resourceType: 'user',
      resourceId: userId,
      oldValue: { status: previousStatus },
      newValue: { status: newStatus },
      reason,
    });

    this.logger.log({ userId, action }, 'User moderated');
    return { userId, newStatus };
  }

  /** Admin-only FF unbind (PLAYER-008). */
  async ffUnbind(admin: RequestUser, playerId: string, reason: string) {
    const binding = await this.prisma.playerFfBinding.findFirst({
      where: { playerId, status: 'active' },
    });
    if (!binding) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'No active FF binding.',
      );
    }

    // Check no active tournament participation
    const activeReg = await this.prisma.registration.findFirst({
      where: {
        members: { some: { playerId } },
        tournament: { status: { in: [...ACTIVE_TOURNAMENT_STATUSES] } },
        status: { in: ['confirmed', 'checked_in'] },
      },
    });
    if (activeReg) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Player has active tournament participation. Cannot unbind.',
      );
    }

    await this.prisma.playerFfBinding.update({
      where: { id: binding.id },
      data: { status: 'removed', unboundAt: new Date(), unboundReason: reason },
    });

    await this.prisma.adminAction.create({
      data: {
        adminId: admin.id,
        action: 'player.ff_unbind',
        targetType: 'player',
        targetId: playerId,
        reason,
        details: { ffUid: binding.ffUid },
      },
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'admin.ff_unbind',
      resourceType: 'player_ff_binding',
      resourceId: binding.id,
      oldValue: { status: 'active', ffUid: binding.ffUid },
      newValue: { status: 'removed' },
      reason,
    });

    this.logger.log(
      { playerId, ffUid: binding.ffUid },
      'FF binding removed by admin',
    );
    return { playerId, unboundFfUid: binding.ffUid };
  }

  /** List admin actions (audit trail). */
  async listActions(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.adminAction.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminAction.count(),
    ]);
    return { items, total, page, limit };
  }

  /** Dashboard stats (ADMIN-001). */
  async getDashboardStats() {
    const [
      totalUsers,
      totalPlayers,
      totalOrganizers,
      totalTournaments,
      activeTournaments,
      openDisputes,
      pendingFunding,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.player.count(),
      this.prisma.organizer.count(),
      this.prisma.tournament.count({ where: { isDeleted: false } }),
      this.prisma.tournament.count({
        where: {
          status: { in: [...ACTIVE_TOURNAMENT_STATUSES] },
          isDeleted: false,
        },
      }),
      this.prisma.dispute.count({
        where: { status: { in: ['submitted', 'under_review'] } },
      }),
      this.prisma.fundingRequest.count({ where: { status: 'submitted' } }),
    ]);

    return {
      totalUsers,
      totalPlayers,
      totalOrganizers,
      totalTournaments,
      activeTournaments,
      openDisputes,
      pendingFunding,
    };
  }
}
