import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../config/database.service.js';
import type { RequestUser } from '../common/decorators/current-user.decorator.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { AccessAuthorityService } from './access-authority.service.js';
import { TournamentAuthorityService } from './tournament-authority.service.js';

const ACTIVE_REGISTRATION_STATUSES = [
  'confirmed',
  'checked_in',
  'pending_invite',
] as const;

@Injectable()
export class RegistrationAuthorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessAuthorityService,
    private readonly tournaments: TournamentAuthorityService,
  ) {}

  async getRegistrationContext(user: RequestUser, tournamentId: string) {
    this.access.assertActiveUser(user);

    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
    });
    if (!tournament) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Tournament not found.',
      );
    }
    if (tournament.status !== 'registration_open') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Registration is not open.',
      );
    }

    const player = await this.access.getActivePlayerForUser(user.id, true);
    return { tournament, player };
  }

  async getEligiblePlayerIdForUser(user: RequestUser): Promise<string> {
    const player = await this.access.getActivePlayerForUser(user.id, true);
    return player.id;
  }

  assertSoloTournament(tournament: { mode: string }): void {
    if (tournament.mode !== 'solo') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Solo registration is only for solo tournaments.',
      );
    }
  }

  assertTeamTournament(tournament: { mode: string }): void {
    if (tournament.mode === 'solo') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Use solo registration for solo tournaments.',
      );
    }
  }

  assertExactRoster(mode: string, playerIds: string[]): void {
    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== playerIds.length) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Roster contains duplicate players.',
      );
    }

    const expected = this.tournaments.rosterSize(mode);
    if (playerIds.length !== expected) {
      throw new BadRequestError(
        ErrorCodes.ROSTER_INCOMPLETE,
        `${mode} registration requires exactly ${expected} players.`,
      );
    }
  }

  async assertPlayersEligible(playerIds: string[]): Promise<void> {
    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds }, isDeleted: false },
      include: {
        ffBindings: {
          where: { status: 'active' },
          take: 1,
        },
      },
    });

    if (players.length !== playerIds.length) {
      throw new BadRequestError(
        ErrorCodes.PLAYER_INELIGIBLE,
        'Every roster member must have a player profile.',
      );
    }

    const ineligible = players.find(
      (player: { status: string; ffBindings: unknown[] }) =>
        player.status !== 'active' || player.ffBindings.length === 0,
    );
    if (ineligible) {
      throw new ForbiddenError(
        ErrorCodes.PLAYER_INELIGIBLE,
        'Every roster member must be active and have an active Free Fire binding.',
      );
    }
  }

  async assertNoActiveMembership(
    tx: PrismaService,
    tournamentId: string,
    playerIds: string[],
  ): Promise<void> {
    const existingMember = await tx.registrationMember.findFirst({
      where: {
        playerId: { in: playerIds },
        registration: {
          tournamentId,
          status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
        },
      },
    });

    if (existingMember) {
      throw new ConflictError(
        ErrorCodes.ALREADY_REGISTERED,
        'One or more players are already registered or invited for this tournament.',
      );
    }
  }

  async reserveConfirmedSlot(
    tx: PrismaService,
    tournamentId: string,
    maxUnits: number,
  ): Promise<number> {
    const confirmedCount = await tx.registration.count({
      where: {
        tournamentId,
        status: { in: ['confirmed', 'checked_in'] },
      },
    });

    if (confirmedCount >= maxUnits) {
      throw new BadRequestError(
        ErrorCodes.CAPACITY_EXCEEDED,
        'Tournament is full.',
      );
    }

    return confirmedCount + 1;
  }

  async assertCanCheckIn(
    user: RequestUser,
    registration: RegistrationWithMembers,
  ): Promise<void> {
    if (this.access.isAdmin(user)) return;

    const playerId = await this.access.getPlayerIdForUser(user.id, false);
    const isMember = registration.members.some(
      (member: { playerId: string }) => member.playerId === playerId,
    );
    if (!isMember) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Only roster members can check in.',
      );
    }
  }

  async assertCanWithdraw(
    user: RequestUser,
    registration: RegistrationWithMembers,
  ): Promise<void> {
    if (this.access.isAdmin(user)) return;

    const playerId = await this.access.getPlayerIdForUser(user.id, false);
    if (registration.captainPlayerId !== playerId) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Only the team captain can withdraw.',
      );
    }
  }

  assertCanConfirmInviteCapacity(count: number, maxUnits: number): number {
    if (count >= maxUnits) {
      throw new BadRequestError(
        ErrorCodes.CAPACITY_EXCEEDED,
        'Tournament is full.',
      );
    }
    return count + 1;
  }
}

type RegistrationWithMembers = Prisma.RegistrationGetPayload<{
  include: { members: true };
}>;
