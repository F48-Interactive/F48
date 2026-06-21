import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { TournamentAuthorityService } from '../../domain/tournament-authority.service.js';

@Injectable()
export class TournamentQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: TournamentAuthorityService,
  ) {}

  async getById(tournamentId: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
      include: {
        organizer: {
          select: {
            id: true,
            displayName: true,
            verificationStatus: true,
            youtubeChannels: {
              where: { status: 'active' },
              take: 1,
              select: {
                channelName: true,
                handle: true,
                url: true,
                imageUrl: true,
              },
            },
          },
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
          bannerAssetId: true,
          createdAt: true,
          organizer: {
            select: {
              id: true,
              displayName: true,
              youtubeChannels: {
                where: { status: 'active' },
                take: 1,
                select: {
                  channelName: true,
                  handle: true,
                  url: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return { items, total, page: filters.page, limit: filters.limit };
  }

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
}
