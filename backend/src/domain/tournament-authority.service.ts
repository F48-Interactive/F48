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
import { assertFundingShape } from './tournament-funding-policy.js';
import {
  assertPrizeConfig as assertPrizeConfigPolicy,
  assertPublishableConfig as assertPublishableConfigPolicy,
  assertScoringConfig as assertScoringConfigPolicy,
  assertTiebreakConfig as assertTiebreakConfigPolicy,
} from './tournament-config-policy.js';

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
    assertScoringConfigPolicy(tournament, data);
  }

  assertPrizeConfig(
    tournament: { prizePoolPaise: bigint; maxUnits: number },
    data: PrizeConfigInput,
  ): void {
    assertPrizeConfigPolicy(tournament, data);
  }

  assertTiebreakConfig(data: TiebreakConfigInput): void {
    assertTiebreakConfigPolicy(data);
  }

  async assertTransitionPrerequisites(
    tournamentId: string,
    action: string,
  ): Promise<void> {
    if (action === 'publish' || action === 'open_registration') {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          activeConfigVersionId: true,
          fundingType: true,
          prizePoolPaise: true,
          maxUnits: true,
        },
      });

      if (!tournament) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Tournament must exist before publishing.',
        );
      }

      if (tournament.fundingType === 'entry_fee') {
        throw new BadRequestError(
          ErrorCodes.FEATURE_DISABLED,
          'Entry-fee tournaments are disabled until wallet support is enabled.',
        );
      }

      const config = tournament.activeConfigVersionId
        ? await this.prisma.tournamentConfigVersion.findFirst({
            where: {
              id: tournament.activeConfigVersionId,
              tournamentId,
            },
            select: {
              placementPoints: { select: { id: true } },
              prizeRules: { select: { amountPaise: true } },
              tiebreakRules: { select: { priority: true, field: true } },
            },
          })
        : null;

      assertPublishableConfigPolicy(tournament, config);
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
