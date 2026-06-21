import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import type {
  PrizeConfigInput,
  ScoringConfigInput,
  TiebreakConfigInput,
} from './dto/tournament.dto.js';
import { AccessAuthorityService } from '../../domain/access-authority.service.js';
import { TournamentAuthorityService } from '../../domain/tournament-authority.service.js';

@Injectable()
export class TournamentConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessAuthorityService,
    private readonly authority: TournamentAuthorityService,
  ) {}

  async setScoringConfig(
    user: RequestUser,
    tournamentId: string,
    data: ScoringConfigInput,
  ) {
    const tournament = await this.assertOwnership(user, tournamentId);

    if (!['draft', 'published'].includes(tournament.status)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot change scoring config in ${tournament.status} status.`,
      );
    }
    this.authority.assertScoringConfig(tournament, data);

    const lastConfig = await this.prisma.tournamentConfigVersion.findFirst({
      where: { tournamentId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (lastConfig?.versionNumber ?? 0) + 1;

    const config = await this.prisma.tournamentConfigVersion.create({
      data: {
        tournamentId,
        versionNumber: nextVersion,
        scoringModel: data.scoringModel,
        killMultiplier: data.killMultiplier,
        placementPoints: {
          create: data.placementPoints.map((p) => ({
            position: p.position,
            points: p.points,
          })),
        },
      },
      include: { placementPoints: true },
    });

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        activeConfigVersionId: config.id,
        scoringModel: data.scoringModel,
      },
    });

    return config;
  }

  async setPrizeConfig(
    user: RequestUser,
    tournamentId: string,
    configVersionId: string,
    data: PrizeConfigInput,
  ) {
    const tournament = await this.assertOwnership(user, tournamentId);
    const config = await this.getEditableConfig(tournamentId, configVersionId);

    this.authority.assertPrizeConfig(tournament, data);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      await db.prizeRule.deleteMany({ where: { configVersionId: config.id } });

      return Promise.all(
        data.rules.map((r) =>
          db.prizeRule.create({
            data: {
              configVersionId: config.id,
              rankStart: r.rankStart,
              rankEnd: r.rankEnd,
              amountPaise: BigInt(r.amountPaise),
            },
          }),
        ),
      );
    });
  }

  async setTiebreakConfig(
    user: RequestUser,
    tournamentId: string,
    configVersionId: string,
    data: TiebreakConfigInput,
  ) {
    await this.assertOwnership(user, tournamentId);
    const config = await this.getEditableConfig(tournamentId, configVersionId);

    this.authority.assertTiebreakConfig(data);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      await db.tiebreakRule.deleteMany({
        where: { configVersionId: config.id },
      });

      return Promise.all(
        data.rules.map((r) =>
          db.tiebreakRule.create({
            data: {
              configVersionId: config.id,
              priority: r.priority,
              field: r.field,
            },
          }),
        ),
      );
    });
  }

  private async getEditableConfig(
    tournamentId: string,
    configVersionId: string,
  ) {
    const config = await this.prisma.tournamentConfigVersion.findFirst({
      where: { id: configVersionId, tournamentId },
    });
    if (!config) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Config version not found.',
      );
    }
    if (config.isLocked) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Config version is locked.',
      );
    }
    return config;
  }

  private async assertOwnership(user: RequestUser, tournamentId: string) {
    return this.access.assertTournamentManager(user, tournamentId);
  }
}
