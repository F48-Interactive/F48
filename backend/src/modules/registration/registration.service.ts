/**
 * RegistrationService — Solo/team registration, check-in, withdrawal.
 * REG-001 to REG-011.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Register solo player for a tournament. */
  async registerSolo(user: RequestUser, tournamentId: string) {
    const { tournament, player } = await this.validateRegistration(user, tournamentId);

    // Check for existing registration
    const existing = await this.prisma.registration.findUnique({
      where: { tournamentId_captainPlayerId: { tournamentId, captainPlayerId: player.id } },
    });
    if (existing) {
      throw new ConflictError(ErrorCodes.DUPLICATE_RESOURCE, 'Already registered.');
    }

    // Check capacity
    const count = await this.prisma.registration.count({
      where: { tournamentId, status: { in: ['confirmed', 'checked_in'] } },
    });
    if (count >= tournament.maxUnits) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Tournament is full.');
    }

    const registration = await this.prisma.registration.create({
      data: {
        tournamentId,
        captainPlayerId: player.id,
        status: 'confirmed',
        slotNumber: count + 1,
        members: {
          create: { playerId: player.id, role: 'captain', inviteStatus: 'accepted' },
        },
      },
      include: { members: true },
    });

    this.eventBus.emit({
      eventType: 'tournament.registration_count.changed',
      entityType: 'tournament',
      entityId: tournamentId,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: { confirmedCount: count + 1, maxRegistrations: tournament.maxUnits },
    });

    this.logger.log({ tournamentId, playerId: player.id }, 'Solo registration');
    return registration;
  }

  /** Register team (duo/squad) for a tournament. */
  async registerTeam(
    user: RequestUser,
    tournamentId: string,
    memberPlayerIds: string[],
    teamName?: string,
  ) {
    const { tournament, player } = await this.validateRegistration(user, tournamentId);

    if (tournament.mode === 'solo') {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Use solo registration for solo tournaments.');
    }

    const maxMembers = tournament.mode === 'duo' ? 2 : 4;
    const allPlayerIds = [player.id, ...memberPlayerIds];
    if (allPlayerIds.length > maxMembers) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, `Max ${maxMembers} players for ${tournament.mode}.`);
    }

    const existing = await this.prisma.registration.findUnique({
      where: { tournamentId_captainPlayerId: { tournamentId, captainPlayerId: player.id } },
    });
    if (existing) {
      throw new ConflictError(ErrorCodes.DUPLICATE_RESOURCE, 'Already registered.');
    }

    const count = await this.prisma.registration.count({
      where: { tournamentId, status: { in: ['confirmed', 'checked_in', 'pending_invite'] } },
    });
    if (count >= tournament.maxUnits) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Tournament is full.');
    }

    const registration = await this.prisma.registration.create({
      data: {
        tournamentId,
        captainPlayerId: player.id,
        status: memberPlayerIds.length > 0 ? 'pending_invite' : 'confirmed',
        teamName,
        slotNumber: count + 1,
        members: {
          create: [
            { playerId: player.id, role: 'captain', inviteStatus: 'accepted' },
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

    this.logger.log({ tournamentId, teamSize: allPlayerIds.length }, 'Team registration');
    return registration;
  }

  /** Check-in to a tournament. */
  async checkIn(user: RequestUser, registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { tournament: true },
    });

    if (!registration) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Registration not found.');
    }
    if (registration.tournament.status !== 'check_in') {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Check-in is not open.');
    }
    if (registration.status !== 'confirmed') {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, `Cannot check in from ${registration.status}.`);
    }

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
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Registration not found.');
    }
    if (!['confirmed', 'checked_in', 'pending_invite'].includes(registration.status)) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Cannot withdraw.');
    }

    // Only captain or admin can withdraw
    const isCaptainMember = registration.members.some(
      (m: { playerId: string }) => m.playerId === user.id || registration.captainPlayerId === user.id,
    );
    if (!isCaptainMember && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not authorized.');
    }

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'withdrawn', withdrawnAt: new Date(), withdrawReason: reason },
    });
  }

  /** Respond to team invite. */
  async respondToInvite(playerId: string, registrationId: string, response: 'accepted' | 'declined') {
    const member = await this.prisma.registrationMember.findFirst({
      where: { registrationId, playerId, inviteStatus: 'pending' },
    });
    if (!member) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Invitation not found.');
    }

    await this.prisma.registrationMember.update({
      where: { id: member.id },
      data: { inviteStatus: response },
    });

    // If all invites accepted, confirm registration
    if (response === 'accepted') {
      const allMembers = await this.prisma.registrationMember.findMany({
        where: { registrationId },
      });
      const allAccepted = allMembers.every((m: { inviteStatus: string }) => m.inviteStatus === 'accepted');
      if (allAccepted) {
        await this.prisma.registration.update({
          where: { id: registrationId },
          data: { status: 'confirmed' },
        });
      }
    }

    return { status: response };
  }

  /** List registrations for a tournament. */
  async listByTournament(tournamentId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.registration.findMany({
        where: { tournamentId },
        include: { members: true },
        orderBy: { slotNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.registration.count({ where: { tournamentId } }),
    ]);
    return { items, total, page, limit };
  }

  private async validateRegistration(user: RequestUser, tournamentId: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
    });
    if (!tournament) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Tournament not found.');
    }
    if (tournament.status !== 'registration_open') {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Registration is not open.');
    }

    const player = await this.prisma.player.findUnique({ where: { userId: user.id } });
    if (!player) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'Player profile required.');
    }
    if (player.status !== 'active') {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Player account is not active.');
    }

    return { tournament, player };
  }
}
