import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../config/database.service.js';
import { BadRequestError } from '../lib/errors.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import type {
  CreateTournamentInput,
  PrizeConfigInput,
  ScoringConfigInput,
  TiebreakConfigInput,
  UpdateTournamentInput,
} from '../modules/tournament/dto/tournament.dto.js';
import {
  assertFundingShape,
  requiresPrizePool,
} from './tournament-funding-policy.js';

type TournamentMode = 'solo' | 'duo' | 'squad';

export const MODE_CAPACITY: Record<TournamentMode, number> = {
  solo: 48,
  duo: 24,
  squad: 12,
};

export const MODE_ROSTER_SIZE: Record<TournamentMode, number> = {
  solo: 1,
  duo: 2,
  squad: 4,
};

const PUBLIC_TOURNAMENT_STATUSES: readonly string[] = [
  'published',
  'registration_open',
  'registration_closed',
  'check_in',
  'live',
  'provisional_results',
  'dispute_window',
  'results_final',
  'completed',
];

const REQUIRED_TIEBREAK_ORDER = [
  'total_booyahs',
  'total_kills',
  'final_match_placement',
] as const;

@Injectable()
export class TournamentAuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  modeCapacity(mode: string): number {
    return MODE_CAPACITY[this.assertMode(mode)];
  }

  rosterSize(mode: string): number {
    return MODE_ROSTER_SIZE[this.assertMode(mode)];
  }

  assertCreateInput(data: CreateTournamentInput): void {
    this.assertModeCapacity(data.mode, data.maxUnits);
    assertFundingShape(
      data.fundingType,
      data.entryFeePaise,
      data.prizePoolPaise,
    );
    this.assertScheduleShape(
      data.registrationOpenAt,
      data.registrationCloseAt,
      data.scheduledStartAt,
    );
  }

  assertUpdateInput(
    existing: {
      mode: string;
      maxUnits: number;
      fundingType: string;
      entryFeePaise: bigint | null;
      prizePoolPaise: bigint;
    },
    data: UpdateTournamentInput,
  ): void {
    const nextMode = data.mode ?? existing.mode;
    const nextMaxUnits = data.maxUnits ?? existing.maxUnits;
    const nextFundingType = data.fundingType ?? existing.fundingType;
    const nextEntryFee =
      data.entryFeePaise ??
      (existing.entryFeePaise ? Number(existing.entryFeePaise) : undefined);
    const nextPrizePool =
      data.prizePoolPaise ?? Number(existing.prizePoolPaise);

    this.assertModeCapacity(nextMode, nextMaxUnits);
    assertFundingShape(nextFundingType, nextEntryFee, nextPrizePool);
    this.assertScheduleShape(
      data.registrationOpenAt,
      data.registrationCloseAt,
      data.scheduledStartAt,
    );
  }

  assertScoringConfig(
    tournament: { mode: string; maxUnits: number },
    data: ScoringConfigInput,
  ): void {
    this.assertModeCapacity(tournament.mode, tournament.maxUnits);

    if (
      data.scoringModel === 'placement_only' &&
      decimalToNumber(data.killMultiplier) !== 0
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Placement-only scoring must use a 0.00 kill multiplier.',
      );
    }

    if (
      data.scoringModel !== 'placement_only' &&
      decimalToNumber(data.killMultiplier) <= 0
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Kill multiplier must be greater than zero.',
      );
    }

    const expectedPositions = new Set<number>();
    for (let position = 1; position <= tournament.maxUnits; position += 1) {
      expectedPositions.add(position);
    }

    const seen = new Set<number>();
    for (const entry of data.placementPoints) {
      if (seen.has(entry.position)) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Duplicate placement position.',
        );
      }
      seen.add(entry.position);
      expectedPositions.delete(entry.position);
    }

    if (expectedPositions.size > 0 || seen.size !== tournament.maxUnits) {
      throw new BadRequestError(
        ErrorCodes.INVALID_PLACEMENT,
        `Placement table must include every position from 1 to ${tournament.maxUnits}.`,
      );
    }

    const sorted = [...data.placementPoints].sort(
      (a, b) => a.position - b.position,
    );
    let previousPoints = Number.POSITIVE_INFINITY;
    for (const entry of sorted) {
      const points = decimalToNumber(entry.points);
      if (points > previousPoints) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Placement points must be non-increasing by position.',
        );
      }
      previousPoints = points;
    }

    const finalRow = sorted[sorted.length - 1];
    if (!finalRow || decimalToNumber(finalRow.points) !== 0) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Position ${tournament.maxUnits} must be locked to 0 placement points.`,
      );
    }
  }

  assertPrizeConfig(
    tournament: { prizePoolPaise: bigint; maxUnits: number },
    data: PrizeConfigInput,
  ): void {
    if (tournament.prizePoolPaise <= 0n) {
      throw new BadRequestError(
        ErrorCodes.PRIZE_POOL_MISMATCH,
        'Prize pool must be funded before prize rules are configured.',
      );
    }

    const seenRanks = new Set<number>();
    let sum = 0n;

    for (const rule of data.rules) {
      if (rule.rankStart !== rule.rankEnd) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Prize rules must target exact final ranks; ranges are not allowed.',
        );
      }
      if (rule.rankStart > tournament.maxUnits) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Prize rank exceeds tournament capacity.',
        );
      }
      if (rule.amountPaise <= 0) {
        throw new BadRequestError(
          ErrorCodes.INVALID_AMOUNT,
          'Prize amounts must be positive.',
        );
      }
      if (seenRanks.has(rule.rankStart)) {
        throw new BadRequestError(
          ErrorCodes.DUPLICATE_RESOURCE,
          'Duplicate prize rank.',
        );
      }

      seenRanks.add(rule.rankStart);
      sum += BigInt(rule.amountPaise);
    }

    if (sum !== tournament.prizePoolPaise) {
      throw new BadRequestError(
        ErrorCodes.PRIZE_POOL_MISMATCH,
        'Prize rules must sum exactly to the tournament prize pool.',
        {
          expectedPaise: tournament.prizePoolPaise.toString(),
          actualPaise: sum.toString(),
        },
      );
    }
  }

  assertTiebreakConfig(data: TiebreakConfigInput): void {
    const priorities = new Set<number>();
    const fields = new Set<string>();

    for (const rule of data.rules) {
      if (priorities.has(rule.priority)) {
        throw new BadRequestError(
          ErrorCodes.DUPLICATE_RESOURCE,
          'Duplicate tiebreak priority.',
        );
      }
      if (fields.has(rule.field)) {
        throw new BadRequestError(
          ErrorCodes.DUPLICATE_RESOURCE,
          'Duplicate tiebreak field.',
        );
      }
      priorities.add(rule.priority);
      fields.add(rule.field);
    }

    for (let priority = 1; priority <= data.rules.length; priority += 1) {
      if (!priorities.has(priority)) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Tiebreak priorities must be contiguous from 1.',
        );
      }
    }

    for (const field of REQUIRED_TIEBREAK_ORDER) {
      if (!fields.has(field)) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          `Tiebreak config must include ${field}.`,
        );
      }
    }
  }

  async assertTransitionPrerequisites(
    tournamentId: string,
    action: string,
  ): Promise<void> {
    if (action === 'publish' || action === 'open_registration') {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament?.activeConfigVersionId) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Active scoring config is required before publishing.',
        );
      }

      if (tournament.fundingType === 'entry_fee') {
        throw new BadRequestError(
          ErrorCodes.FEATURE_DISABLED,
          'Entry-fee tournaments are disabled until wallet support is enabled.',
        );
      }

      if (
        requiresPrizePool(tournament.fundingType) &&
        tournament.prizePoolPaise <= 0n
      ) {
        throw new BadRequestError(
          ErrorCodes.PRIZE_POOL_MISMATCH,
          'Prize pool must be set before this tournament can open.',
        );
      }
    }

    if (action === 'finalize_results') {
      const matchResults = await this.prisma.matchResult.findMany({
        where: { match: { tournamentId } },
        select: { id: true },
      });

      const openDisputes = await this.prisma.dispute.count({
        where: {
          matchResultId: {
            in: matchResults.map((result: { id: string }) => result.id),
          },
          status: {
            in: [
              'submitted',
              'under_review',
              'info_requested',
              'investigating',
            ],
          },
        },
      });

      if (openDisputes > 0) {
        throw new BadRequestError(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Cannot finalize results while disputes are unresolved.',
        );
      }
    }
  }

  publicListWhere(filters: {
    status?: string;
    mode?: string;
  }): Prisma.TournamentWhereInput {
    if (
      filters.status &&
      !PUBLIC_TOURNAMENT_STATUSES.includes(filters.status)
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Requested tournament status is not public.',
      );
    }

    const where: Prisma.TournamentWhereInput = {
      isDeleted: false,
      status: filters.status
        ? (filters.status as any)
        : { in: [...PUBLIC_TOURNAMENT_STATUSES] as any },
    };

    if (filters.mode) {
      where.mode = this.assertMode(filters.mode) as any;
    }

    return where;
  }

  private assertMode(mode: string): TournamentMode {
    if (mode !== 'solo' && mode !== 'duo' && mode !== 'squad') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Invalid tournament mode.',
      );
    }
    return mode;
  }

  private assertModeCapacity(mode: string, maxUnits: number): void {
    const expected = this.modeCapacity(mode);
    if (maxUnits !== expected) {
      throw new BadRequestError(
        ErrorCodes.CAPACITY_EXCEEDED,
        `${mode} tournaments must use exactly ${expected} units.`,
      );
    }
  }

  private assertScheduleShape(
    registrationOpenAt?: string,
    registrationCloseAt?: string,
    scheduledStartAt?: string,
  ): void {
    if (registrationOpenAt && registrationCloseAt) {
      const opensAt = new Date(registrationOpenAt).getTime();
      const closesAt = new Date(registrationCloseAt).getTime();
      if (opensAt >= closesAt) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Registration close time must be after open time.',
        );
      }
    }

    if (registrationCloseAt && scheduledStartAt) {
      const closesAt = new Date(registrationCloseAt).getTime();
      const startsAt = new Date(scheduledStartAt).getTime();
      if (closesAt >= startsAt) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Tournament start time must be after registration close time.',
        );
      }
    }
  }
}

function decimalToNumber(value: string): number {
  return Number.parseFloat(value);
}
