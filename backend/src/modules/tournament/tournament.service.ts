/**
 * TournamentService — Core tournament CRUD, state transitions, config versioning.
 * TOUR-001 to TOUR-004, LIFE-001/002, DATA-005.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  tournamentStateMachine,
  type TournamentAction,
  type TournamentState,
} from './tournament.state-machine.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import type {
  CreateTournamentInput,
  UpdateTournamentInput,
  ScoringConfigInput,
  PrizeConfigInput,
  TiebreakConfigInput,
} from './dto/tournament.dto.js';
import { TournamentAuthorityService } from '../../domain/tournament-authority.service.js';
import { AccessAuthorityService } from '../../domain/access-authority.service.js';

@Injectable()
export class TournamentService {
  private readonly logger = new Logger(TournamentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
    private readonly eventBus: EventBusService,
    private readonly authority: TournamentAuthorityService,
    private readonly access: AccessAuthorityService,
  ) {}

  // ─── Create Tournament (Draft) ──────────────────────────────────────────
  async create(user: RequestUser, data: CreateTournamentInput) {
    this.authority.assertCreateInput(data);

    // Must have an organizer profile
    const organizer = await this.prisma.organizer.findUnique({
      where: { userId: user.id },
    });
    if (!organizer) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Organizer profile required.',
      );
    }
    if (organizer.verificationStatus !== 'verified') {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Organizer must be verified.',
      );
    }

    const tournament = await this.prisma.tournament.create({
      data: {
        organizerId: organizer.id,
        title: data.title,
        description: data.description,
        mode: data.mode,
        fundingType: data.fundingType,
        structureType: data.structureType,
        scoringModel: data.scoringModel,
        maxUnits: data.maxUnits,
        entryFeePaise: data.entryFeePaise ? BigInt(data.entryFeePaise) : null,
        scheduledStartAt: data.scheduledStartAt
          ? new Date(data.scheduledStartAt)
          : null,
        registrationOpenAt: data.registrationOpenAt
          ? new Date(data.registrationOpenAt)
          : null,
        registrationCloseAt: data.registrationCloseAt
          ? new Date(data.registrationCloseAt)
          : null,
        checkInDurationMin: data.checkInDurationMin,
        disputeWindowHours: data.disputeWindowHours ?? 24,
        gameMapId: data.gameMapId,
        rulesText: data.rulesText,
        status: 'draft',
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'tournament.create',
      resourceType: 'tournament',
      resourceId: tournament.id,
      newValue: { title: data.title, mode: data.mode },
    });

    this.logger.log({ tournamentId: tournament.id }, 'Tournament created');
    return tournament;
  }

  // ─── Get Tournament ─────────────────────────────────────────────────────
  async getById(tournamentId: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
      include: {
        organizer: {
          select: { id: true, displayName: true, verificationStatus: true },
        },
        stages: { orderBy: { stageOrder: 'asc' } },
        configVersions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            placementPoints: true,
            prizeRules: true,
            tiebreakRules: true,
          },
        },
        fundingRequest: true,
        gameMap: true,
      },
    });

    if (!tournament) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Tournament not found.',
      );
    }

    return tournament;
  }

  // ─── Update Tournament (Draft/Changes Required) ─────────────────────────
  async update(
    user: RequestUser,
    tournamentId: string,
    data: UpdateTournamentInput,
  ) {
    const tournament = await this.assertOwnership(user, tournamentId);
    this.authority.assertUpdateInput(tournament, data);

    if (
      tournament.status !== 'draft' &&
      tournament.status !== 'changes_required'
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot edit tournament in ${tournament.status} status.`,
      );
    }

    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.mode !== undefined && { mode: data.mode }),
        ...(data.maxUnits !== undefined && { maxUnits: data.maxUnits }),
        ...(data.entryFeePaise !== undefined && {
          entryFeePaise: BigInt(data.entryFeePaise),
        }),
        ...(data.scheduledStartAt !== undefined && {
          scheduledStartAt: new Date(data.scheduledStartAt),
        }),
        ...(data.registrationOpenAt !== undefined && {
          registrationOpenAt: new Date(data.registrationOpenAt),
        }),
        ...(data.registrationCloseAt !== undefined && {
          registrationCloseAt: new Date(data.registrationCloseAt),
        }),
        ...(data.checkInDurationMin !== undefined && {
          checkInDurationMin: data.checkInDurationMin,
        }),
        ...(data.disputeWindowHours !== undefined && {
          disputeWindowHours: data.disputeWindowHours,
        }),
        ...(data.gameMapId !== undefined && { gameMapId: data.gameMapId }),
        ...(data.rulesText !== undefined && { rulesText: data.rulesText }),
        ...(data.bannerAssetId !== undefined && {
          bannerAssetId: data.bannerAssetId,
        }),
      },
    });

    return updated;
  }

  // ─── State Transition ───────────────────────────────────────────────────
  async transition(
    user: RequestUser,
    tournamentId: string,
    action: string,
    reason?: string,
  ) {
    const tournament = await this.access.assertTournamentManager(
      user,
      tournamentId,
    );

    const currentState = tournament.status as TournamentState;
    const newState = tournamentStateMachine.transition(
      currentState,
      action as TournamentAction,
      { role: user.role as any, reason },
    );
    await this.authority.assertTransitionPrerequisites(tournamentId, action);

    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: newState, version: { increment: 1 } },
    });

    await this.statusHistory.record({
      resourceType: 'tournament',
      resourceId: tournamentId,
      previousStatus: currentState,
      newStatus: newState,
      actorId: user.id,
      reason,
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: `tournament.${action}`,
      resourceType: 'tournament',
      resourceId: tournamentId,
      oldValue: { status: currentState },
      newValue: { status: newState },
      reason,
    });

    this.eventBus.emit({
      eventType: 'tournament.status.changed',
      entityType: 'tournament',
      entityId: tournamentId,
      version: updated.version,
      timestamp: new Date().toISOString(),
      payload: {
        previousStatus: currentState,
        newStatus: newState,
        tournamentName: tournament.title,
      },
    });

    this.logger.log(
      { tournamentId, from: currentState, to: newState, action },
      'Tournament transitioned',
    );
    return updated;
  }

  // ─── Scoring Config Versioning (DATA-005, SCORE-009) ────────────────────
  async setScoringConfig(
    user: RequestUser,
    tournamentId: string,
    data: ScoringConfigInput,
  ) {
    const tournament = await this.assertOwnership(user, tournamentId);

    if (
      !['draft', 'changes_required', 'approved'].includes(tournament.status)
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot change scoring config in ${tournament.status} status.`,
      );
    }
    this.authority.assertScoringConfig(tournament, data);

    // Get next version number
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

    // Set as active config
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        activeConfigVersionId: config.id,
        scoringModel: data.scoringModel,
      },
    });

    return config;
  }

  // ─── Prize Config ──────────────────────────────────────────────────────
  async setPrizeConfig(
    user: RequestUser,
    tournamentId: string,
    configVersionId: string,
    data: PrizeConfigInput,
  ) {
    const tournament = await this.assertOwnership(user, tournamentId);

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
    this.authority.assertPrizeConfig(tournament, data);

    const rules = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      await db.prizeRule.deleteMany({ where: { configVersionId } });

      return Promise.all(
        data.rules.map((r) =>
          db.prizeRule.create({
            data: {
              configVersionId,
              rankStart: r.rankStart,
              rankEnd: r.rankEnd,
              amountPaise: BigInt(r.amountPaise),
            },
          }),
        ),
      );
    });

    return rules;
  }

  // ─── Tiebreak Config ───────────────────────────────────────────────────
  async setTiebreakConfig(
    user: RequestUser,
    tournamentId: string,
    configVersionId: string,
    data: TiebreakConfigInput,
  ) {
    await this.assertOwnership(user, tournamentId);

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
    this.authority.assertTiebreakConfig(data);

    const rules = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      await db.tiebreakRule.deleteMany({ where: { configVersionId } });

      return Promise.all(
        data.rules.map((r) =>
          db.tiebreakRule.create({
            data: {
              configVersionId,
              priority: r.priority,
              field: r.field,
            },
          }),
        ),
      );
    });

    return rules;
  }

  // ─── List Tournaments ──────────────────────────────────────────────────
  async list(filters: {
    status?: string;
    mode?: string;
    page: number;
    limit: number;
  }) {
    const where = this.authority.publicListWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        select: {
          id: true,
          title: true,
          mode: true,
          status: true,
          fundingType: true,
          structureType: true,
          maxUnits: true,
          prizePoolPaise: true,
          scheduledStartAt: true,
          bannerAssetId: true,
          createdAt: true,
          organizer: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      items,
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  // ─── My Tournaments (Organizer) ────────────────────────────────────────
  async listByOrganizer(userId: string, page: number, limit: number) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { userId },
    });
    if (!organizer) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Organizer profile not found.',
      );
    }

    const where = { organizerId: organizer.id, isDeleted: false };
    const [items, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ─── Ownership Check ───────────────────────────────────────────────────
  private async assertOwnership(user: RequestUser, tournamentId: string) {
    return this.access.assertTournamentManager(user, tournamentId);
  }
}
