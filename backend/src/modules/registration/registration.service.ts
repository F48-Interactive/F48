/**
 * RegistrationService — Solo/team slot booking, check-in, withdrawal.
 * REG-001 to REG-011.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../config/database.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { RegistrationAuthorityService } from '../../domain/registration-authority.service.js';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly authority: RegistrationAuthorityService,
  ) {}

  /** Register solo player for a tournament. */
  async registerSolo(user: RequestUser, tournamentId: string) {
    const { tournament, player } = await this.authority.getRegistrationContext(
      user,
      tournamentId,
    );
    this.authority.assertSoloTournament(tournament);

    const registration = await this.prisma.$transaction(
      async (tx) => {
        const db = tx as unknown as PrismaService;
        await this.authority.assertNoActiveMembership(db, tournamentId, [
          player.id,
        ]);
        const slotNumber = await this.authority.reserveConfirmedSlot(
          db,
          tournamentId,
          tournament.maxUnits,
        );

        return db.registration.create({
          data: {
            tournamentId,
            captainPlayerId: player.id,
            status: 'confirmed',
            slotNumber,
            members: {
              create: {
                playerId: player.id,
                role: 'captain',
                inviteStatus: 'accepted',
              },
            },
          },
          include: { members: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.eventBus.emit({
      eventType: 'tournament.registration_count.changed',
      entityType: 'tournament',
      entityId: tournamentId,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        confirmedCount: registration.slotNumber ?? 1,
        maxRegistrations: tournament.maxUnits,
      },
    });

    this.logger.log({ tournamentId, playerId: player.id }, 'Solo slot booking');
    return registration;
  }

  /** Register team (duo/squad) for a tournament. */
  async registerTeam(
    user: RequestUser,
    tournamentId: string,
    memberPlayerIds: string[],
    teamName?: string,
  ) {
    const { tournament, player } = await this.authority.getRegistrationContext(
      user,
      tournamentId,
    );
    this.authority.assertTeamTournament(tournament);

    const allPlayerIds = [player.id, ...memberPlayerIds];
    this.authority.assertExactRoster(tournament.mode, allPlayerIds);
    await this.authority.assertPlayersEligible(allPlayerIds);

    const registration = await this.prisma.$transaction(
      async (tx) => {
        const db = tx as unknown as PrismaService;
        await this.authority.assertNoActiveMembership(
          db,
          tournamentId,
          allPlayerIds,
        );

        return db.registration.create({
          data: {
            tournamentId,
            captainPlayerId: player.id,
            status: 'pending_invite',
            teamName,
            slotNumber: null,
            members: {
              create: [
                {
                  playerId: player.id,
                  role: 'captain',
                  inviteStatus: 'accepted',
                },
                ...memberPlayerIds.map((pid) => ({
                  playerId: pid,
                  role: 'member' as const,
                  inviteStatus: 'pending',
                })),
              ],
            },
          },
          include: { members: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      { tournamentId, teamSize: allPlayerIds.length },
      'Team slot booking',
    );
    return registration;
  }

  /** Check-in to a tournament. */
  async checkIn(user: RequestUser, registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { tournament: true, members: true },
    });

    if (!registration) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Registration not found.',
      );
    }
    if (registration.tournament.status !== 'check_in') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Check-in is not open.',
      );
    }
    if (registration.status !== 'confirmed') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot check in from ${registration.status}.`,
      );
    }

    await this.authority.assertCanCheckIn(user, registration);

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'checked_in', checkedInAt: new Date() },
    });
  }

  /** Withdraw from tournament. */
  async withdraw(user: RequestUser, registrationId: string, reason?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { members: true },
    });
    if (!registration) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Registration not found.',
      );
    }
    if (
      !['confirmed', 'checked_in', 'pending_invite'].includes(
        registration.status,
      )
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Cannot withdraw.',
      );
    }

    await this.authority.assertCanWithdraw(user, registration);

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'withdrawn',
        withdrawnAt: new Date(),
        withdrawReason: reason,
      },
    });
  }

  /** Respond to team invite. */
  async respondToInvite(
    user: RequestUser,
    registrationId: string,
    response: 'accepted' | 'declined',
  ) {
    const playerId = await this.authority.getEligiblePlayerIdForUser(user);

    const member = await this.prisma.registrationMember.findFirst({
      where: { registrationId, playerId, inviteStatus: 'pending' },
    });
    if (!member) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Invitation not found.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        const db = tx as unknown as PrismaService;

        await db.registrationMember.update({
          where: { id: member.id },
          data: { inviteStatus: response },
        });

        if (response === 'declined') {
          await db.registration.update({
            where: { id: registrationId },
            data: {
              status: 'withdrawn',
              withdrawnAt: new Date(),
              withdrawReason: 'Team invite declined.',
            },
          });
          return;
        }

        const registration = await db.registration.findUnique({
          where: { id: registrationId },
          include: { members: true, tournament: true },
        });
        if (!registration) {
          throw new NotFoundError(
            ErrorCodes.RESOURCE_NOT_FOUND,
            'Registration not found.',
          );
        }

        const allAccepted = registration.members.every(
          (m: { inviteStatus: string }) => m.inviteStatus === 'accepted',
        );
        if (allAccepted) {
          const count = await db.registration.count({
            where: {
              tournamentId: registration.tournamentId,
              status: { in: ['confirmed', 'checked_in'] },
            },
          });
          const slotNumber = this.authority.assertCanConfirmInviteCapacity(
            count,
            registration.tournament.maxUnits,
          );

          await db.registration.update({
            where: { id: registrationId },
            data: { status: 'confirmed', slotNumber },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { status: response };
  }

  /** List registrations for a tournament. */
  async listByTournament(tournamentId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.registration.findMany({
        where: { tournamentId, status: { in: ['confirmed', 'checked_in'] } },
        include: { members: true },
        orderBy: { slotNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.registration.count({
        where: { tournamentId, status: { in: ['confirmed', 'checked_in'] } },
      }),
    ]);
    return { items, total, page, limit };
  }
}
