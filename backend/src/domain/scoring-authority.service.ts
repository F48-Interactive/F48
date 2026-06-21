import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { BadRequestError } from '../lib/errors.js';
import { ErrorCodes } from '../common/constants/error-codes.js';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export interface LeaderboardEntry {
  registrationId: string;
  totalPoints: Decimal;
  totalKills: number;
  totalBooyahs: number;
  matchesPlayed: number;
  bestPlacement: number;
  placements: number[];
}

@Injectable()
export class ScoringAuthorityService {
  calculatePlayerScore(input: {
    scoringModel: string;
    killMultiplier: Decimal;
    placementPoints: Decimal | undefined;
    placement: number;
    kills: number;
    penaltyPoints: Decimal;
  }) {
    if (!input.placementPoints) {
      throw new BadRequestError(
        ErrorCodes.INVALID_PLACEMENT,
        `No placement points configured for position ${input.placement}.`,
      );
    }

    let killPoints = new Decimal(0);
    if (input.scoringModel !== 'placement_only') {
      killPoints = new Decimal(input.kills).mul(input.killMultiplier);
    }

    let totalPoints: Decimal;
    if (input.scoringModel === 'placement_only') {
      totalPoints = input.placementPoints;
    } else if (input.scoringModel === 'kills_only') {
      totalPoints = killPoints;
    } else {
      totalPoints = input.placementPoints.add(killPoints);
    }

    return {
      placementPoints: input.placementPoints,
      killPoints,
      totalPoints: totalPoints.sub(input.penaltyPoints),
    };
  }

  sortLeaderboard(
    entries: LeaderboardEntry[],
    tiebreakFields: string[],
  ): LeaderboardEntry[] {
    return [...entries].sort((a, b) => {
      const pointsCmp = b.totalPoints.cmp(a.totalPoints);
      if (pointsCmp !== 0) return pointsCmp;

      for (const field of tiebreakFields) {
        const cmp = this.compareTiebreak(field, a, b);
        if (cmp !== 0) return cmp;
      }

      return a.registrationId.localeCompare(b.registrationId);
    });
  }

  private compareTiebreak(
    field: string,
    a: LeaderboardEntry,
    b: LeaderboardEntry,
  ): number {
    switch (field) {
      case 'total_booyahs':
        return b.totalBooyahs - a.totalBooyahs;
      case 'total_kills':
        return b.totalKills - a.totalKills;
      case 'final_match_placement':
        return lastPlacement(a) - lastPlacement(b);
      case 'average_placement':
        return averagePlacement(a) - averagePlacement(b);
      case 'higher_placement_count':
        return higherPlacementCount(b) - higherPlacementCount(a);
      case 'fewer_penalties':
      case 'deciding_match':
        return 0;
      default:
        return 0;
    }
  }
}

function lastPlacement(entry: LeaderboardEntry): number {
  return (
    entry.placements[entry.placements.length - 1] ?? Number.MAX_SAFE_INTEGER
  );
}

function averagePlacement(entry: LeaderboardEntry): number {
  if (entry.placements.length === 0) return Number.MAX_SAFE_INTEGER;
  return (
    entry.placements.reduce((sum, placement) => sum + placement, 0) /
    entry.placements.length
  );
}

function higherPlacementCount(entry: LeaderboardEntry): number {
  return entry.placements.filter((placement) => placement <= 3).length;
}
