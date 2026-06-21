/**
 * PlayerService — Business logic for player profiles and FF bindings.
 * PLAYER-001 to PLAYER-010.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { FreeFireLookupAdapter } from '../../providers/games-kinbo/games-kinbo.adapter.js';
import {
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  BadRequestError,
  InternalError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { generatePlatformId } from '../../lib/platform-id.js';
import type { CreatePlayerInput, UpdatePlayerInput } from './dto/player.dto.js';

// ─── Rate-Limit Bucket ─────────────────────────────────────────────────────
interface RateBucket {
  count: number;
  resetAt: number;
}

const FF_LOOKUP_MAX = 5;
const FF_LOOKUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PLATFORM_ID_RETRIES = 3;

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private readonly ffLookupBuckets = new Map<string, RateBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
    private readonly eventBus: EventBusService,
    private readonly ffLookup: FreeFireLookupAdapter,
  ) {}

  // ─── PLAYER-001/002: Create Profile ────────────────────────────────────
  async createProfile(userId: string, data: CreatePlayerInput) {
    // Check if player already exists
    const existing = await this.prisma.player.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Player profile already exists for this user.',
      );
    }

    // PLAYER-003: case-insensitive username uniqueness
    const usernameLower = data.username.toLowerCase();
    const nameTaken = await this.prisma.player.findUnique({
      where: { usernameLower },
    });
    if (nameTaken) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Username is already taken.',
      );
    }

    // PLAYER-001/002: generate Platform ID with retry on collision
    let platformId: string | undefined;
    for (let attempt = 0; attempt < PLATFORM_ID_RETRIES; attempt++) {
      const candidate = generatePlatformId();
      const collision = await this.prisma.player.findUnique({
        where: { platformId: candidate },
      });
      if (!collision) {
        platformId = candidate;
        break;
      }
      this.logger.warn(`Platform ID collision on attempt ${attempt + 1}: ${candidate}`);
    }
    if (!platformId) {
      throw new InternalError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to generate unique Platform ID. Please try again.',
      );
    }

    const player = await this.prisma.player.create({
      data: {
        userId,
        platformId,
        username: data.username,
        usernameLower,
        displayName: data.username,
        status: 'active',
      },
    });

    await this.audit.log({
      actorId: userId,
      actorRole: 'player',
      action: 'player.create',
      resourceType: 'player',
      resourceId: player.id,
      newValue: { platformId, username: data.username },
    });

    await this.statusHistory.record({
      resourceType: 'player',
      resourceId: player.id,
      previousStatus: 'none',
      newStatus: 'active',
      actorId: userId,
    });

    this.eventBus.emit({
      eventType: 'player.ff_binding.updated',
      entityType: 'player',
      entityId: player.id,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: { action: 'bound' as const },
    });

    this.logger.log({ userId, playerId: player.id, platformId }, 'Player profile created');
    return player;
  }

  // ─── PLAYER-001: Get Own Profile ────────────────────────────────────────
  async getProfile(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        ffBindings: { where: { status: 'active' } },
      },
    });
    if (!player) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Player profile not found. Create one first.',
      );
    }
    return player;
  }

  // ─── PLAYER-003: Update Profile ─────────────────────────────────────────
  async updateProfile(userId: string, data: UpdatePlayerInput) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Player profile not found.',
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.username !== undefined) {
      const usernameLower = data.username.toLowerCase();
      if (usernameLower !== player.usernameLower) {
        const nameTaken = await this.prisma.player.findUnique({
          where: { usernameLower },
        });
        if (nameTaken) {
          throw new ConflictError(
            ErrorCodes.DUPLICATE_RESOURCE,
            'Username is already taken.',
          );
        }
      }
      updateData.username = data.username;
      updateData.usernameLower = data.username.toLowerCase();
    }

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName;
    }

    if (Object.keys(updateData).length === 0) {
      return player;
    }

    const updated = await this.prisma.player.update({
      where: { userId },
      data: updateData,
    });

    await this.audit.log({
      actorId: userId,
      actorRole: 'player',
      action: 'player.update',
      resourceType: 'player',
      resourceId: player.id,
      oldValue: { username: player.username, displayName: player.displayName },
      newValue: updateData as Record<string, unknown>,
    });

    return updated;
  }

  // ─── PLAYER-006/007: FF Lookup ──────────────────────────────────────────
  async ffLookupByUid(playerId: string, ffUid: string) {
    this.checkFfLookupRate(playerId);

    const result = await this.ffLookup.lookupByUid(ffUid);

    if (!result.success || !result.account) {
      throw new BadRequestError(
        ErrorCodes.PROVIDER_ERROR,
        result.error ?? 'Free Fire account lookup failed.',
      );
    }

    return result.account;
  }

  // ─── PLAYER-004/005: FF Bind ────────────────────────────────────────────
  async ffBind(playerId: string, userId: string, ffUid: string, ffNickname: string) {
    // PLAYER-004: no existing active binding for this player
    const existingPlayerBinding = await this.prisma.playerFfBinding.findFirst({
      where: { playerId, status: 'active' },
    });
    if (existingPlayerBinding) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'You already have an active Free Fire binding. Contact support to change it.',
      );
    }

    // PLAYER-005: no active binding globally for this UID
    const existingUidBinding = await this.prisma.playerFfBinding.findFirst({
      where: { ffUid, status: 'active' },
    });
    if (existingUidBinding) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'This Free Fire UID is already bound to another player.',
      );
    }

    const binding = await this.prisma.playerFfBinding.create({
      data: { playerId, ffUid, ffNickname, status: 'active' },
    });

    await this.audit.log({
      actorId: userId,
      actorRole: 'player',
      action: 'player.ff_bind',
      resourceType: 'player_ff_binding',
      resourceId: binding.id,
      newValue: { ffUid, ffNickname, playerId },
    });

    this.eventBus.emit({
      eventType: 'player.ff_binding.updated',
      entityType: 'player',
      entityId: playerId,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: { action: 'bound' as const },
    });

    this.logger.log({ playerId, ffUid }, 'FF UID bound');
    return binding;
  }

  // ─── Search Players ─────────────────────────────────────────────────────
  async searchPlayers(query: string, type: 'platform_id' | 'username') {
    if (type === 'platform_id') {
      const player = await this.prisma.player.findUnique({
        where: { platformId: query },
        select: {
          id: true,
          platformId: true,
          username: true,
          displayName: true,
          avatarAssetId: true,
          status: true,
        },
      });
      return player ? [player] : [];
    }

    // Case-insensitive username contains search
    return this.prisma.player.findMany({
      where: {
        usernameLower: { contains: query.toLowerCase() },
        isDeleted: false,
      },
      select: {
        id: true,
        platformId: true,
        username: true,
        displayName: true,
        avatarAssetId: true,
        status: true,
      },
      take: 20,
    });
  }

  // ─── Public Profile ─────────────────────────────────────────────────────
  async getPublicProfile(playerId: string) {
    const player = await this.prisma.player.findFirst({
      where: { id: playerId, isDeleted: false },
      select: {
        id: true,
        platformId: true,
        username: true,
        displayName: true,
        avatarAssetId: true,
        status: true,
        createdAt: true,
        ffBindings: {
          where: { status: 'active' },
          select: { ffUid: true, ffNickname: true, boundAt: true },
        },
      },
    });

    if (!player) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Player not found.',
      );
    }

    return player;
  }

  // ─── Rate-Limit Helper ──────────────────────────────────────────────────
  private checkFfLookupRate(playerId: string): void {
    const now = Date.now();
    const bucket = this.ffLookupBuckets.get(playerId);

    if (!bucket || now >= bucket.resetAt) {
      this.ffLookupBuckets.set(playerId, { count: 1, resetAt: now + FF_LOOKUP_WINDOW_MS });
      return;
    }

    if (bucket.count >= FF_LOOKUP_MAX) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      throw new TooManyRequestsError(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `FF lookup rate limit exceeded. Try again in ${retryAfterSec}s.`,
        { retryAfterSec },
      );
    }

    bucket.count++;
  }
}
