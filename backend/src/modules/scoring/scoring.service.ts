/**
 * ScoringService — Calculate points from match results, build leaderboard.
 * SCORE-001 to SCORE-010.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { Prisma } from '../../generated/prisma/client.js';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Calculate points for all player results in a match (SCORE-001/002/003).
   * Called after result submission, before finalization.
   */
  async calculateMatchPoints(matchId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Match not found.');

    const result = await this.prisma.matchResult.findUnique({
      where: { matchId },
      include: { playerResults: true },
    });
    if (!result) throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Match result not found.');

    // Get active config version
    const config = match.tournament.activeConfigVersionId
      ? await this.prisma.tournamentConfigVersion.findUnique({
          where: { id: match.tournament.activeConfigVersionId },
          include: { placementPoints: { orderBy: { position: 'asc' } } },
        })
      : null;

    if (!config) {
      throw new BadRequestError(ErrorCodes.VALIDATION_FAILED, 'No scoring config set.');
    }

    const killMultiplier = new Decimal(config.killMultiplier);
    const placementMap = new Map<number, Prisma.Decimal>(
      config.placementPoints.map((pp: { position: number; points: Prisma.Decimal }) => [pp.position, new Decimal(pp.points)]),
    );

    // Calculate points for each player result
    for (const pr of result.playerResults) {
      const placementPts = placementMap.get(pr.placement) ?? new Decimal(0);

      let killPts = new Decimal(0);
      if (config.scoringModel !== 'placement_only') {
        killPts = new Decimal(pr.kills).mul(killMultiplier);
      }

      let totalPts: Decimal;
      if (config.scoringModel === 'placement_only') {
        totalPts = placementPts;
      } else if (config.scoringModel === 'kills_only') {
        totalPts = killPts;
      } else {
        totalPts = placementPts.add(killPts);
      }

      // Subtract penalties
      totalPts = totalPts.sub(new Decimal(pr.penaltyPoints));
      if (totalPts.lt(new Decimal(0))) totalPts = new Decimal(0);

      await this.prisma.matchPlayerResult.update({
        where: { id: pr.id },
        data: {
          placementPoints: placementPts,
          killPoints: killPts,
          totalPoints: totalPts,
        },
      });
    }

    this.logger.log({ matchId, playerCount: result.playerResults.length }, 'Match points calculated');
    return { matchId, calculatedCount: result.playerResults.length };
  }

  /**
   * Build tournament leaderboard (aggregated across all matches).
   * SCORE-004/005: Aggregates total points per registration.
   */
  async getLeaderboard(tournamentId: string) {
    // Get all finalized match results
    const results = await this.prisma.matchPlayerResult.findMany({
      where: {
        matchResult: {
          match: { tournamentId },
          status: { in: ['submitted', 'provisional', 'finalized'] },
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

    // Aggregate per registration
    const aggMap = new Map<string, {
      registrationId: string;
      totalPoints: Decimal;
      totalKills: number;
      totalBooyahs: number;
      matchesPlayed: number;
      bestPlacement: number;
      placements: number[];
    }>();

    for (const r of results) {
      const existing = aggMap.get(r.registrationId);
      if (existing) {
        existing.totalPoints = existing.totalPoints.add(new Decimal(r.totalPoints));
        existing.totalKills += r.kills;
        existing.totalBooyahs += r.isBooyah ? 1 : 0;
        existing.matchesPlayed += 1;
        if (r.placement < existing.bestPlacement) existing.bestPlacement = r.placement;
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

    // Sort by total points descending (SCORE-004)
    const leaderboard = Array.from(aggMap.values())
      .sort((a, b) => {
        const diff = b.totalPoints.sub(a.totalPoints).toNumber();
        if (diff !== 0) return diff;
        // Tiebreak: more booyahs → more kills → better best placement
        if (b.totalBooyahs !== a.totalBooyahs) return b.totalBooyahs - a.totalBooyahs;
        if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
        return a.bestPlacement - b.bestPlacement;
      })
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
        totalPoints: entry.totalPoints.toString(),
        avgPlacement: entry.placements.length > 0
          ? (entry.placements.reduce((a, b) => a + b, 0) / entry.placements.length).toFixed(2)
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

  /** Get a single registration's scoring breakdown across all matches. */
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
