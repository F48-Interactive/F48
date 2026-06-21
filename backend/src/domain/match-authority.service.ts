import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../config/database.service.js';
import type { RequestUser } from '../common/decorators/current-user.decorator.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { AccessAuthorityService } from './access-authority.service.js';

const MATCH_TRANSITIONS: Record<string, readonly string[]> = {
  scheduled: ['check_in', 'room_released', 'delayed', 'canceled'],
  check_in: ['room_released', 'delayed', 'canceled'],
  room_released: ['live', 'delayed', 'canceled'],
  delayed: ['scheduled', 'check_in', 'room_released', 'canceled'],
  live: ['awaiting_result', 'voided'],
  awaiting_result: ['result_submitted', 'voided'],
  result_submitted: ['finalized', 'awaiting_result', 'voided'],
  finalized: [],
  canceled: [],
  voided: [],
};

@Injectable()
export class MatchAuthorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessAuthorityService,
  ) {}

  async getManagedMatch(user: RequestUser, matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { tournament: { include: { organizer: true } }, room: true },
    });

    if (!match) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Match not found.',
      );
    }

    if (
      !this.access.isAdmin(user) &&
      match.tournament.organizer.userId !== user.id
    ) {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not authorized.');
    }

    return match;
  }

  async assertRoomAccess(
    user: RequestUser,
    match: { tournamentId: string },
  ): Promise<void> {
    if (this.access.isAdmin(user)) return;

    const playerId = await this.access.getPlayerIdForUser(user.id, false);
    const registration = await this.prisma.registration.findFirst({
      where: {
        tournamentId: match.tournamentId,
        status: 'checked_in',
        members: { some: { playerId } },
      },
      select: { id: true },
    });

    if (!registration) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Not checked in for this tournament.',
      );
    }
  }

  assertMatchTransition(currentStatus: string, nextStatus: string): void {
    const allowed = MATCH_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestError(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Cannot transition match from ${currentStatus} to ${nextStatus}.`,
      );
    }
  }

  async assertResultRows(
    match: ManagedMatch,
    playerResults: Array<{
      registrationId: string;
      placement: number;
      kills: number;
      isBooyah?: boolean;
    }>,
  ): Promise<void> {
    if (playerResults.length === 0) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'At least one result row is required.',
      );
    }

    const registrationIds = new Set<string>();
    const placements = new Set<number>();
    let booyahCount = 0;

    for (const row of playerResults) {
      if (registrationIds.has(row.registrationId)) {
        throw new BadRequestError(
          ErrorCodes.DUPLICATE_RESOURCE,
          'Duplicate registration result.',
        );
      }
      if (placements.has(row.placement)) {
        throw new BadRequestError(
          ErrorCodes.DUPLICATE_PLACEMENT,
          'Duplicate placement.',
        );
      }
      if (row.placement < 1 || row.placement > match.room.maxUnits) {
        throw new BadRequestError(
          ErrorCodes.INVALID_PLACEMENT,
          `Placement must be between 1 and ${match.room.maxUnits}.`,
        );
      }
      if (row.kills < 0) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Kills cannot be negative.',
        );
      }
      if (row.isBooyah || row.placement === 1) {
        booyahCount += 1;
      }
      registrationIds.add(row.registrationId);
      placements.add(row.placement);
    }

    if (booyahCount !== 1) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Exactly one result row must be the Booyah.',
      );
    }

    const checkedIn = await this.prisma.registration.findMany({
      where: {
        id: { in: [...registrationIds] },
        tournamentId: match.tournamentId,
        status: 'checked_in',
      },
      select: { id: true },
    });

    if (checkedIn.length !== registrationIds.size) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Every result registration must be checked in for this tournament.',
      );
    }
  }
}

type ManagedMatch = Prisma.TournamentMatchGetPayload<{
  include: { tournament: { include: { organizer: true } }; room: true };
}>;
