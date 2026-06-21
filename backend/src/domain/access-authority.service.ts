import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database.service.js';
import type { RequestUser } from '../common/decorators/current-user.decorator.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';

@Injectable()
export class AccessAuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: Pick<RequestUser, 'role'>): boolean {
    return user.role === 'admin' || user.role === 'super_admin';
  }

  assertActiveUser(user: RequestUser): void {
    if (
      user.status === 'suspended' ||
      user.status === 'banned' ||
      user.status === 'deleted'
    ) {
      throw new ForbiddenError(
        ErrorCodes.ACCOUNT_SUSPENDED,
        'Account restricted.',
      );
    }
  }

  async getActivePlayerForUser(userId: string, requireFfBinding = true) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        ffBindings: {
          where: { status: 'active' },
          take: 1,
          orderBy: { boundAt: 'desc' },
        },
      },
    });

    if (!player) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Player profile required.',
      );
    }

    if (player.status !== 'active' || player.isDeleted) {
      throw new ForbiddenError(
        ErrorCodes.PLAYER_INELIGIBLE,
        'Player account is not active.',
      );
    }

    if (requireFfBinding && player.ffBindings.length === 0) {
      throw new ForbiddenError(
        ErrorCodes.PLAYER_INELIGIBLE,
        'Active Free Fire binding required.',
      );
    }

    return player;
  }

  async getPlayerIdForUser(
    userId: string,
    requireFfBinding = false,
  ): Promise<string> {
    const player = await this.getActivePlayerForUser(userId, requireFfBinding);
    return player.id;
  }

  async assertTournamentManager(user: RequestUser, tournamentId: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
      include: { organizer: true },
    });

    if (!tournament) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Tournament not found.',
      );
    }

    if (!this.isAdmin(user) && tournament.organizer.userId !== user.id) {
      throw new ForbiddenError(
        ErrorCodes.RESOURCE_NOT_OWNED,
        'Not your tournament.',
      );
    }

    return tournament;
  }
}
