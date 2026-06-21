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

const MAX_ROOMS = 4;

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
    this.assertModeCapacity(data.mode, data.structureType, data.maxUnits);
    this.assertStageConfig(data);
    assertFundingShape(
      data.fundingType,
      data.entryFeePaise,
      data.prizePoolPaise,
    );
  }

  assertUpdateInput(
    existing: {
      mode: string;
      structureType: string;
      maxUnits: number;
      fundingType: string;
      entryFeePaise: bigint | null;
      prizePoolPaise: bigint;
    },
    data: UpdateTournamentInput,
  ): void {
    const nextMode = data.mode ?? existing.mode;
    const nextStructureType = data.structureType ?? existing.structureType;
    const nextMaxUnits = data.maxUnits ?? existing.maxUnits;
    const nextFundingType = data.fundingType ?? existing.fundingType;
    const nextEntryFee =
      data.entryFeePaise ??
      (existing.entryFeePaise ? Number(existing.entryFeePaise) : undefined);
    const nextPrizePool =
      data.prizePoolPaise ?? Number(existing.prizePoolPaise);

    this.assertModeCapacity(nextMode, nextStructureType, nextMaxUnits);
    assertFundingShape(nextFundingType, nextEntryFee, nextPrizePool);
  }

  assertScoringConfig(
    tournament: { mode: string; maxUnits: number },
    data: ScoringConfigInput,
  ): void {
    assertScoringConfigPolicy(
      { placementSlots: this.modeCapacity(tournament.mode) },
      data,
    );
  }

  assertPrizeConfig(
    tournament: { mode: string; prizePoolPaise: bigint; maxUnits: number },
    data: PrizeConfigInput,
  ): void {
    assertPrizeConfigPolicy(
      {
        prizePoolPaise: tournament.prizePoolPaise,
        prizeSlots: this.modeCapacity(tournament.mode),
      },
      data,
    );
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
          bannerAssetId: true,
          fundingType: true,
          mode: true,
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

      if (!tournament.bannerAssetId) {
        throw new BadRequestError(
          ErrorCodes.VALIDATION_FAILED,
          'Tournament banner is required before publishing.',
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

      assertPublishableConfigPolicy(
        {
          fundingType: tournament.fundingType,
          prizePoolPaise: tournament.prizePoolPaise,
          placementSlots: this.modeCapacity(tournament.mode),
        },
        config,
      );
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

  private assertModeCapacity(
    mode: string,
    _structureType: string,
    maxUnits: number,
  ): void {
    const roomCapacity = this.modeCapacity(mode);
    const maxCapacity = roomCapacity * MAX_ROOMS;

    if (maxUnits < 2 || maxUnits > maxCapacity) {
      throw new BadRequestError(
        ErrorCodes.CAPACITY_EXCEEDED,
        `${mode} tournaments must use 2-${maxCapacity} slots.`,
      );
    }
  }

  private assertStageConfig(data: CreateTournamentInput): void {
    const roomCapacity = this.modeCapacity(data.mode);
    const expectedRooms = Math.ceil(data.maxUnits / roomCapacity);
    const stageConfig = data.stageConfig;

    if (!stageConfig) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Stage configuration is required before creating a tournament.',
      );
    }

    if (stageConfig.roomCount !== expectedRooms) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Room count must be ${expectedRooms}.`,
      );
    }

    if (stageConfig.matchesPerRoom < 1) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'At least one match per room is required.',
      );
    }
  }

}
