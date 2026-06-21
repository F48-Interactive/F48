import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  ScoringAuthorityService,
  type LeaderboardEntry,
} from '../../domain/scoring-authority.service.js';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly authority: ScoringAuthorityService,
  ) {}

  async calculateMatchPoints(matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match)
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Match not found.',
      );

    const result = await this.prisma.matchResult.findUnique({
      where: { matchId },
      include: { playerResults: true },
    });
    if (!result)
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Match result not found.',
      );

    const config = match.tournament.activeConfigVersionId
      ? await this.prisma.tournamentConfigVersion.findUnique({
          where: { id: match.tournament.activeConfigVersionId },
          include: { placementPoints: { orderBy: { position: 'asc' } } },
        })
      : null;

    if (!config) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'No scoring config set.',
      );
    }

    const killMultiplier = new Decimal(config.killMultiplier);
    const placementMap = new Map<number, Decimal>(
      config.placementPoints.map(
        (pp: { position: number; points: Prisma.Decimal }) => [
          pp.position,
          new Decimal(pp.points),
        ],
      ),
    );

    for (const pr of result.playerResults) {
      const score = this.authority.calculatePlayerScore({
        scoringModel: config.scoringModel,
        killMultiplier,
        placementPoints: placementMap.get(pr.placement),
        placement: pr.placement,
        kills: pr.kills,
        penaltyPoints: new Decimal(pr.penaltyPoints),
      });

      await this.prisma.matchPlayerResult.update({
        where: { id: pr.id },
        data: {
          placementPoints: score.placementPoints,
          killPoints: score.killPoints,
          totalPoints: score.totalPoints,
        },
      });
    }

    this.logger.log(
      { matchId, playerCount: result.playerResults.length },
      'Match points calculated',
    );
    return { matchId, calculatedCount: result.playerResults.length };
  }

  async getLeaderboard(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { activeConfigVersionId: true },
    });

    const tiebreakRules = tournament?.activeConfigVersionId
      ? await this.prisma.tiebreakRule.findMany({
          where: { configVersionId: tournament.activeConfigVersionId },
          orderBy: { priority: 'asc' },
        })
      : [];

    const tiebreakFields =
      tiebreakRules.length > 0
        ? tiebreakRules.map((rule: { field: string }) => rule.field)
        : ['total_booyahs', 'total_kills', 'final_match_placement'];

    const results = await this.prisma.matchPlayerResult.findMany({
      where: {
        matchResult: {
          match: { tournamentId },
          status: { in: ['provisional', 'finalized'] },
        },
      },
      select: {
        registrationId: true,
        placement: true,
        kills: true,
        totalPoints: true,
        isBooyah: true,
      },
    });

    const aggMap = new Map<string, LeaderboardEntry>();

    for (const r of results) {
      const existing = aggMap.get(r.registrationId);
      if (existing) {
        existing.totalPoints = existing.totalPoints.add(
          new Decimal(r.totalPoints),
        );
        existing.totalKills += r.kills;
        existing.totalBooyahs += r.isBooyah ? 1 : 0;
        existing.matchesPlayed += 1;
        if (r.placement < existing.bestPlacement)
          existing.bestPlacement = r.placement;
        existing.placements.push(r.placement);
      } else {
        aggMap.set(r.registrationId, {
          registrationId: r.registrationId,
          totalPoints: new Decimal(r.totalPoints),
          totalKills: r.kills,
          totalBooyahs: r.isBooyah ? 1 : 0,
          matchesPlayed: 1,
          bestPlacement: r.placement,
          placements: [r.placement],
        });
      }
    }

    const leaderboard = this.authority
      .sortLeaderboard(Array.from(aggMap.values()), tiebreakFields)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
        totalPoints: entry.totalPoints.toString(),
        avgPlacement:
          entry.placements.length > 0
            ? (
                entry.placements.reduce((a, b) => a + b, 0) /
                entry.placements.length
              ).toFixed(2)
            : '0',
      }));

    this.eventBus.emit({
      eventType: 'leaderboard.updated' as any,
      entityType: 'tournament',
      entityId: tournamentId,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: { entryCount: leaderboard.length },
    } as any);

    return leaderboard;
  }

  async getRegistrationScores(registrationId: string) {
    return this.prisma.matchPlayerResult.findMany({
      where: { registrationId },
      include: {
        matchResult: {
          include: { match: { select: { matchNumber: true, status: true } } },
        },
      },
      orderBy: { matchResult: { match: { matchNumber: 'asc' } } },
    });
  }
}
