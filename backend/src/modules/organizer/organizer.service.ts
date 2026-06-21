/**
 * OrganizerService — Business logic for organizer profiles and verification.
 * ORG-ID-001 to ORG-ID-003, RBAC-004/005.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type {
  CreateOrganizerInput,
  UpdateOrganizerInput,
  VerificationDecisionInput,
} from './dto/organizer.dto.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';

@Injectable()
export class OrganizerService {
  private readonly logger = new Logger(OrganizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create organizer profile. One per user.
   */
  async createProfile(userId: string, data: CreateOrganizerInput) {
    const existing = await this.prisma.organizer.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'You already have an organizer profile.',
      );
    }

    const organizer = await this.prisma.organizer.create({
      data: {
        userId,
        displayName: data.displayName,
        description: data.description,
        verificationStatus: 'profile_incomplete',
        fundingEligibility: 'not_eligible',
      },
    });

    // Update user role to organizer
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'organizer' },
    });

    this.logger.log({ userId, organizerId: organizer.id }, 'Organizer profile created');
    return organizer;
  }

  /**
   * Get organizer profile for authenticated user.
   */
  async getOwnProfile(userId: string) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { userId },
      include: {
        youtubeChannels: true,
        verificationDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!organizer) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Organizer profile not found. Create one first.',
      );
    }

    return organizer;
  }

  /**
   * Update organizer profile.
   */
  async updateProfile(userId: string, data: UpdateOrganizerInput) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { userId },
    });

    if (!organizer) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Organizer profile not found.',
      );
    }

    return this.prisma.organizer.update({
      where: { id: organizer.id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.avatarAssetId !== undefined && {
          avatarAssetId: data.avatarAssetId,
        }),
      },
    });
  }

  /**
   * Submit YouTube channel URL for server-side fetch (ORG-ID-002).
   * Stores channel data after fetching from YouTube API.
   */
  async submitYoutubeChannel(
    userId: string,
    channelUrl: string,
    youtubeLookup: { resolveChannelUrl(url: string): Promise<any> },
  ) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { userId },
    });

    if (!organizer) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Organizer profile not found.',
      );
    }

    // Fetch channel data from YouTube (server-side, ORG-ID-002)
    const result = await youtubeLookup.resolveChannelUrl(channelUrl);

    if (!result.success || !result.channel) {
      throw new BadRequestError(
        ErrorCodes.PROVIDER_ERROR,
        result.error ?? 'Failed to fetch YouTube channel data.',
      );
    }

    const channelData = result.channel;

    // Store channel info
    const channel = await this.prisma.organizerYoutubeChannel.create({
      data: {
        organizerId: organizer.id,
        channelId: channelData.channelId,
        channelName: channelData.channelName,
        handle: channelData.handle,
        url: channelData.url,
        imageUrl: channelData.imageUrl,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        rawChannelData: channelData.rawData ?? {},
      },
    });

    await this.prisma.organizer.update({
      where: { id: organizer.id },
      data: {
        displayName: channelData.channelName,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
      },
    });

    this.logger.log(
      { organizerId: organizer.id, channelId: channel.channelId },
      'YouTube channel submitted',
    );

    return channel;
  }

  /**
   * Admin: review and decide organizer verification (ORG-ID-003).
   * Creates immutable OrgVerificationDecision record.
   */
  async adminVerificationDecision(
    organizerId: string,
    decision: VerificationDecisionInput,
    admin: RequestUser,
  ) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
    });

    if (!organizer) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Organizer not found.',
      );
    }

    // Map decision to verification status
    const statusMap: Record<string, string> = {
      approved: 'verified',
      rejected: 'profile_incomplete',
      restricted: 'restricted',
      suspended: 'suspended',
    };
    const newStatus = statusMap[decision.decision]!;
    const previousStatus = organizer.verificationStatus;

    // Update organizer status + create immutable decision record
    const [updated] = await this.prisma.$transaction([
      this.prisma.organizer.update({
        where: { id: organizerId },
        data: {
          verificationStatus: newStatus as any,
          fundingEligibility: decision.decision === 'approved'
            ? (decision.fundingEligibility as any)
            : organizer.fundingEligibility,
          ...(decision.decision === 'approved' && {
            verifiedAt: new Date(),
            verifiedBy: admin.id,
          }),
        },
      }),
      this.prisma.orgVerificationDecision.create({
        data: {
          organizerId,
          decision: decision.decision as any,
          reason: decision.reason,
          reviewerId: admin.id,
        },
      }),
    ]);

    await this.statusHistory.record({
      resourceType: 'organizer',
      resourceId: organizerId,
      previousStatus,
      newStatus,
      actorId: admin.id,
      reason: decision.reason,
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'organizer.verification_decision',
      resourceType: 'organizer',
      resourceId: organizerId,
      oldValue: { verificationStatus: previousStatus },
      newValue: { verificationStatus: newStatus, decision: decision.decision },
      reason: decision.reason,
    });

    this.eventBus.emit({
      eventType: 'organizer.verification.updated',
      entityType: 'organizer',
      entityId: organizerId,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        previousStatus,
        newStatus,
      },
    } as any);

    this.logger.log(
      { organizerId, decision: decision.decision, admin: admin.id },
      'Organizer verification decision recorded',
    );

    return updated;
  }

  /**
   * List verified organizers (public).
   */
  async listVerified(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.organizer.findMany({
        where: { verificationStatus: 'verified', isDeleted: false },
        select: {
          id: true,
          displayName: true,
          description: true,
          avatarAssetId: true,
          totalTournamentsCompleted: true,
          totalPrizesDistributedPaise: true,
          verifiedAt: true,
          youtubeChannels: {
            where: { status: 'active' },
            take: 1,
            select: {
              channelName: true,
              handle: true,
              url: true,
              imageUrl: true,
              subscriberCount: true,
            },
          },
        },
        orderBy: { verifiedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organizer.count({
        where: { verificationStatus: 'verified', isDeleted: false },
      }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Get organizer public profile.
   */
  async getPublicProfile(organizerId: string) {
    const organizer = await this.prisma.organizer.findFirst({
      where: { id: organizerId, isDeleted: false },
      select: {
        id: true,
        displayName: true,
        description: true,
        avatarAssetId: true,
        verificationStatus: true,
        totalTournamentsCompleted: true,
        totalPrizesDistributedPaise: true,
        verifiedAt: true,
        youtubeChannels: {
          where: { status: 'active' },
          select: {
            channelName: true,
            handle: true,
            url: true,
            imageUrl: true,
            subscriberCount: true,
          },
        },
      },
    });

    if (!organizer) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Organizer not found.',
      );
    }

    return organizer;
  }

  /**
   * Admin: list pending verifications.
   */
  async listPendingVerifications(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.organizer.findMany({
        where: { verificationStatus: 'verification_pending', isDeleted: false },
        include: {
          user: { select: { email: true } },
          youtubeChannels: true,
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organizer.count({
        where: { verificationStatus: 'verification_pending', isDeleted: false },
      }),
    ]);

    return { items, total, page, limit };
  }
}
