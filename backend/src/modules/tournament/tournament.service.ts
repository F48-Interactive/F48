import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { BadRequestError, ForbiddenError } from '../../lib/errors.js';
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
} from './dto/tournament.dto.js';
import { AccessAuthorityService } from '../../domain/access-authority.service.js';
import { TournamentAuthorityService } from '../../domain/tournament-authority.service.js';

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

  async create(user: RequestUser, data: CreateTournamentInput) {
    this.authority.assertCreateInput(data);

    const organizer = await this.prisma.organizer.findUnique({
      where: { userId: user.id },
      include: {
        youtubeChannels: {
          where: { status: 'active' },
          take: 1,
        },
      },
    });
    if (!organizer) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Organizer profile required.',
      );
    }
    if (organizer.youtubeChannels.length === 0) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Connect a YouTube channel before creating tournaments.',
      );
    }

    const tournament = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      const created = await db.tournament.create({
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
          prizePoolPaise: data.prizePoolPaise
            ? BigInt(data.prizePoolPaise)
            : 0n,
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
      await this.createStructure(db, created.id, data);
      return created;
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

  async update(
    user: RequestUser,
    tournamentId: string,
    data: UpdateTournamentInput,
  ) {
    const tournament = await this.access.assertTournamentManager(
      user,
      tournamentId,
    );
    this.authority.assertUpdateInput(tournament, data);

    if (tournament.status !== 'draft') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot edit tournament in ${tournament.status} status.`,
      );
    }

    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.mode !== undefined && { mode: data.mode }),
        ...(data.fundingType !== undefined && {
          fundingType: data.fundingType,
        }),
        ...(data.structureType !== undefined && {
          structureType: data.structureType,
        }),
        ...(data.maxUnits !== undefined && { maxUnits: data.maxUnits }),
        ...(data.entryFeePaise !== undefined && {
          entryFeePaise: BigInt(data.entryFeePaise),
        }),
        ...(data.prizePoolPaise !== undefined && {
          prizePoolPaise: BigInt(data.prizePoolPaise),
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
  }

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

  private async createStructure(
    db: PrismaService,
    tournamentId: string,
    data: CreateTournamentInput,
  ): Promise<void> {
    const config = data.stageConfig!;
    const roomCapacity = this.authority.modeCapacity(data.mode);
    let matchNumber = 1;

    const stage = await db.tournamentStage.create({
      data: {
        tournamentId,
        type: 'final',
        name: 'Main Stage',
        stageOrder: 1,
        advancementCount: null,
        pointsCarryForward: false,
        checkInDurationMin: data.checkInDurationMin,
      },
    });

    for (let roomOrder = 1; roomOrder <= config.roomCount; roomOrder += 1) {
      const remaining = data.maxUnits - (roomOrder - 1) * roomCapacity;
      const room = await db.tournamentRoom.create({
        data: {
          tournamentId,
          stageId: stage.id,
          name: `Room ${roomOrder}`,
          maxUnits: Math.min(roomCapacity, remaining),
          roomOrder,
        },
      });
      matchNumber = await this.createMatches(
        db,
        tournamentId,
        stage.id,
        room.id,
        matchNumber,
        config.matchesPerRoom,
        roomOrder,
        data,
      );
    }
  }

  private async createMatches(
    db: PrismaService,
    tournamentId: string,
    stageId: string,
    roomId: string,
    startNumber: number,
    count: number,
    roomOrder: number,
    data: CreateTournamentInput,
  ): Promise<number> {
    let matchNumber = startNumber;
    for (let matchOrder = 1; matchOrder <= count; matchOrder += 1) {
      const scheduled = data.stageConfig!.matchSchedule.find(
        (entry) =>
          entry.roomOrder === roomOrder &&
          entry.matchOrder === matchOrder,
      );
      await db.tournamentMatch.create({
        data: {
          tournamentId,
          stageId,
          roomId,
          matchNumber,
          scheduledAt: scheduled?.scheduledAt
            ? new Date(scheduled.scheduledAt)
            : null,
        },
      });
      matchNumber += 1;
    }
    return matchNumber;
  }
}
