import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../config/database.service.js';
import type { RequestUser } from '../common/decorators/current-user.decorator.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { AccessAuthorityService } from './access-authority.service.js';

export const DISPUTE_CATEGORIES = [
  'incorrect_score',
  'wrong_placement',
  'kill_count_mismatch',
  'wrong_player',
  'technical_issue',
  'rule_violation',
  'unfair_play',
  'other',
] as const;

export const OPEN_DISPUTE_STATUSES = [
  'submitted',
  'under_review',
  'info_requested',
  'investigating',
] as const;

export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];
export type DisputeStatus =
  | 'submitted'
  | 'under_review'
  | 'info_requested'
  | 'investigating'
  | 'resolved_accepted'
  | 'resolved_rejected'
  | 'resolved_partial'
  | 'withdrawn';

const DISPUTE_TRANSITIONS: Record<DisputeStatus, readonly DisputeStatus[]> = {
  submitted: ['under_review', 'withdrawn'],
  under_review: [
    'info_requested',
    'investigating',
    'resolved_accepted',
    'resolved_rejected',
    'resolved_partial',
  ],
  info_requested: [
    'under_review',
    'investigating',
    'resolved_accepted',
    'resolved_rejected',
    'resolved_partial',
    'withdrawn',
  ],
  investigating: ['resolved_accepted', 'resolved_rejected', 'resolved_partial'],
  resolved_accepted: [],
  resolved_rejected: [],
  resolved_partial: [],
  withdrawn: [],
};

@Injectable()
export class DisputeAuthorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessAuthorityService,
  ) {}

  assertCategory(category: string): DisputeCategory {
    if (!DISPUTE_CATEGORIES.includes(category as DisputeCategory)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Unsupported dispute category.',
      );
    }
    return category as DisputeCategory;
  }

  assertStatus(status: string): DisputeStatus {
    if (!Object.hasOwn(DISPUTE_TRANSITIONS, status)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Unsupported dispute status.',
      );
    }
    return status as DisputeStatus;
  }

  assertTransition(
    currentStatus: string,
    nextStatus: string,
    resolution?: string,
  ): DisputeStatus {
    const current = this.assertStatus(currentStatus);
    const next = this.assertStatus(nextStatus);
    const allowed = DISPUTE_TRANSITIONS[current];

    if (!allowed.includes(next)) {
      throw new BadRequestError(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Cannot transition dispute from ${current} to ${next}.`,
      );
    }

    if (next.startsWith('resolved_') && !resolution?.trim()) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Resolution text is required when resolving a dispute.',
      );
    }

    return next;
  }

  async getFilingContext(user: RequestUser, matchResultId: string) {
    const result = await this.prisma.matchResult.findUnique({
      where: { id: matchResultId },
      include: {
        playerResults: true,
        match: {
          include: {
            tournament: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Match result not found.',
      );
    }

    const tournament = result.match.tournament;
    if (tournament.status !== 'dispute_window') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Dispute window is not open.',
      );
    }

    await this.assertDisputeWindowDeadline(
      tournament.id,
      tournament.disputeWindowHours,
    );

    const player = await this.access.getActivePlayerForUser(user.id, false);
    await this.assertAffectedPlayerCanFile(player.id, result);
    await this.assertNoOpenDisputeByPlayer(player.id, matchResultId);

    return { result, player };
  }

  async assertEvidenceAssets(
    user: RequestUser,
    evidenceAssetIds: string[],
  ): Promise<void> {
    if (evidenceAssetIds.length === 0) return;

    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: evidenceAssetIds } },
      select: {
        id: true,
        uploaderId: true,
        purpose: true,
        accessLevel: true,
      },
    });

    if (assets.length !== evidenceAssetIds.length) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Every dispute evidence asset must exist.',
      );
    }

    const invalid = assets.find(
      (asset: { uploaderId: string; purpose: string; accessLevel: string }) =>
        asset.uploaderId !== user.id ||
        asset.purpose !== 'dispute_evidence' ||
        asset.accessLevel !== 'restricted',
    );

    if (invalid) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Dispute evidence must be restricted assets uploaded by the filing user.',
      );
    }
  }

  async getDisputeForUser(disputeId: string, user: RequestUser) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Dispute not found.',
      );
    }

    if (this.access.isAdmin(user)) return dispute;

    const matchResult = await this.prisma.matchResult.findUnique({
      where: { id: dispute.matchResultId },
      include: {
        match: {
          include: {
            tournament: { include: { organizer: true } },
          },
        },
      },
    });

    if (!matchResult) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Match result not found.',
      );
    }

    if (matchResult.match.tournament.organizer.userId === user.id) {
      return dispute;
    }

    const player = await this.prisma.player.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (player?.id === dispute.filedByPlayerId) return dispute;

    throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not authorized.');
  }

  nextResultStatusAfterDispute(
    status: DisputeStatus,
  ): 'needs_correction' | 'provisional' | null {
    if (status === 'resolved_accepted' || status === 'resolved_partial') {
      return 'needs_correction';
    }
    if (status === 'resolved_rejected' || status === 'withdrawn') {
      return 'provisional';
    }
    return null;
  }

  private async assertDisputeWindowDeadline(
    tournamentId: string,
    windowHours: number,
  ): Promise<void> {
    const opened = await this.prisma.statusHistory.findFirst({
      where: {
        resourceType: 'tournament',
        resourceId: tournamentId,
        newStatus: 'dispute_window',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (!opened) return;

    const deadline = new Date(opened.createdAt);
    deadline.setHours(deadline.getHours() + windowHours);

    if (deadline < new Date()) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Dispute window deadline has passed.',
      );
    }
  }

  private async assertAffectedPlayerCanFile(
    playerId: string,
    result: MatchResultWithTournament,
  ): Promise<void> {
    const registrationIds = result.playerResults.map(
      (row: { registrationId: string }) => row.registrationId,
    );

    const registration = await this.prisma.registration.findFirst({
      where: {
        id: { in: registrationIds },
        OR: [
          { captainPlayerId: playerId },
          {
            tournament: { mode: 'solo' },
            members: { some: { playerId } },
          },
        ],
      },
      include: { members: true, tournament: true },
    });

    if (!registration) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Only an affected solo player or team captain can file this dispute.',
      );
    }
  }

  private async assertNoOpenDisputeByPlayer(
    playerId: string,
    matchResultId: string,
  ): Promise<void> {
    const existing = await this.prisma.dispute.findFirst({
      where: {
        filedByPlayerId: playerId,
        matchResultId,
        status: { in: [...OPEN_DISPUTE_STATUSES] },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'You already have an open dispute for this result.',
      );
    }
  }
}

type MatchResultWithTournament = Prisma.MatchResultGetPayload<{
  include: {
    playerResults: true;
    match: {
      include: {
        tournament: true;
      };
    };
  };
}>;
