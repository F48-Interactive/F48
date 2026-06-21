/**
 * MatchService — Match lifecycle, room credentials, result submission.
 * MATCH-001 to MATCH-003, RESULT-001 to RESULT-004, SEC-006.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Set room credentials for a match (organizer). */
  async setRoomCredentials(
    user: RequestUser,
    matchId: string,
    roomId: string,
    roomPass: string,
    customCode?: string,
  ) {
    const match = await this.getMatchWithAuth(user, matchId);

    if (!['scheduled', 'check_in'].includes(match.status)) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, `Cannot set credentials in ${match.status}.`);
    }

    // Upsert room credential
    const credential = await this.prisma.roomCredential.upsert({
      where: { matchId },
      create: { matchId, roomId, roomPass, customCode },
      update: { roomId, roomPass, customCode },
    });

    // Transition match to room_released
    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: { status: 'room_released' },
    });

    await this.statusHistory.record({
      resourceType: 'match',
      resourceId: matchId,
      previousStatus: match.status,
      newStatus: 'room_released',
      actorId: user.id,
    });

    this.logger.log({ matchId }, 'Room credentials set');
    return { matchId, status: 'room_released' };
  }

  /** Get room credentials (only for checked-in players). */
  async getRoomCredentials(user: RequestUser, matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { roomCredential: true },
    });
    if (!match || !match.roomCredential) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Room credentials not found.');
    }

    // Verify player is checked in for this match's tournament
    const registration = await this.prisma.registration.findFirst({
      where: {
        tournamentId: match.tournamentId,
        status: 'checked_in',
        members: { some: { playerId: user.id } },
      },
    });

    if (!registration && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not checked in for this tournament.');
    }

    return match.roomCredential;
  }

  /** Transition match status. */
  async transitionMatch(user: RequestUser, matchId: string, newStatus: string) {
    const match = await this.getMatchWithAuth(user, matchId);
    const previousStatus = match.status;

    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: newStatus as any,
        ...(newStatus === 'live' && { startedAt: new Date() }),
        ...(newStatus === 'awaiting_result' && { endedAt: new Date() }),
      },
    });

    await this.statusHistory.record({
      resourceType: 'match',
      resourceId: matchId,
      previousStatus,
      newStatus,
      actorId: user.id,
    });

    return { matchId, status: newStatus };
  }

  /** Submit match result (organizer). */
  async submitResult(
    user: RequestUser,
    matchId: string,
    playerResults: Array<{
      registrationId: string;
      placement: number;
      kills: number;
      isBooyah?: boolean;
    }>,
    evidenceAssetId?: string,
  ) {
    const match = await this.getMatchWithAuth(user, matchId);

    if (!['awaiting_result', 'result_submitted'].includes(match.status)) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, `Cannot submit result in ${match.status}.`);
    }

    // Get scoring config for point calculation
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: match.tournamentId },
      include: {
        configVersions: {
          where: { id: match.tournament?.activeConfigVersionId ?? undefined },
          include: { placementPoints: true },
        },
      },
    });

    // Create/update match result
    const result = await this.prisma.matchResult.upsert({
      where: { matchId },
      create: {
        matchId,
        submittedById: user.id,
        status: 'submitted',
        evidenceAssetId,
        submittedAt: new Date(),
        playerResults: {
          create: playerResults.map((pr) => ({
            registrationId: pr.registrationId,
            placement: pr.placement,
            kills: pr.kills,
            isBooyah: pr.isBooyah ?? false,
            // Point calculation done separately via scoring engine
          })),
        },
      },
      update: {
        status: 'submitted',
        evidenceAssetId,
        submittedAt: new Date(),
      },
      include: { playerResults: true },
    });

    // Update match status
    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: { status: 'result_submitted' },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'match.result_submitted',
      resourceType: 'match_result',
      resourceId: result.id,
      newValue: { matchId, resultCount: playerResults.length },
    });

    this.logger.log({ matchId, resultId: result.id }, 'Match result submitted');
    return result;
  }

  /** Get match details with result. */
  async getMatch(matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: {
        matchResult: { include: { playerResults: true } },
        stage: true,
        room: true,
      },
    });
    if (!match) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Match not found.');
    }
    return match;
  }

  /** List matches for a tournament. */
  async listByTournament(tournamentId: string) {
    return this.prisma.tournamentMatch.findMany({
      where: { tournamentId },
      include: { stage: true, room: true },
      orderBy: { matchNumber: 'asc' },
    });
  }

  private async getMatchWithAuth(user: RequestUser, matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { tournament: { include: { organizer: true } } },
    });
    if (!match) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Match not found.');
    }

    // Only tournament organizer or admin can manage matches
    if (
      user.role !== 'admin' && user.role !== 'super_admin' &&
      match.tournament.organizer.userId !== user.id
    ) {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not authorized.');
    }

    return match;
  }
}
