/**
 * FundingService — Funding request lifecycle.
 * Feature-gated behind 'wallet' flag.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StatusHistoryService } from '../audit/status-history.service.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';

@Injectable()
export class FundingService {
  private readonly logger = new Logger(FundingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusHistory: StatusHistoryService,
  ) {}

  /** Create funding request for a tournament. */
  async createRequest(
    user: RequestUser,
    tournamentId: string,
    requestedPaise: bigint,
  ) {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
      include: { organizer: true, fundingRequest: true },
    });

    if (!tournament) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Tournament not found.',
      );
    }
    if (tournament.organizer.userId !== user.id) {
      throw new ForbiddenError(ErrorCodes.FORBIDDEN, 'Not your tournament.');
    }
    if (tournament.fundingType !== 'f48_sponsored') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Only f48_sponsored tournaments can request funding.',
      );
    }
    if (tournament.fundingRequest) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Funding request already exists.',
      );
    }

    const request = await this.prisma.fundingRequest.create({
      data: {
        tournamentId,
        requestedPaise,
        status: 'draft',
      },
    });

    this.logger.log(
      { tournamentId, requestId: request.id },
      'Funding request created',
    );
    return request;
  }

  /** Submit funding request for admin review. */
  async submitRequest(user: RequestUser, requestId: string) {
    const request = await this.getOwnRequest(user, requestId);

    if (request.status !== 'draft' && request.status !== 'changes_required') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot submit from ${request.status} status.`,
      );
    }

    const updated = await this.prisma.fundingRequest.update({
      where: { id: requestId },
      data: { status: 'submitted' },
    });

    await this.statusHistory.record({
      resourceType: 'funding_request',
      resourceId: requestId,
      previousStatus: request.status,
      newStatus: 'submitted',
      actorId: user.id,
    });

    return updated;
  }

  /** Admin: review funding request. */
  async adminReview(
    admin: RequestUser,
    requestId: string,
    decision:
      | 'approved'
      | 'partially_approved'
      | 'rejected'
      | 'changes_required',
    approvedPaise?: bigint,
    notes?: string,
  ) {
    const request = await this.prisma.fundingRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Funding request not found.',
      );
    }
    if (request.status !== 'submitted') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot review from ${request.status} status.`,
      );
    }

    if (decision === 'partially_approved') {
      if (
        !approvedPaise ||
        approvedPaise <= 0n ||
        approvedPaise >= request.requestedPaise
      ) {
        throw new BadRequestError(
          ErrorCodes.INVALID_AMOUNT,
          'Partial approval requires an approved amount greater than zero and less than requested.',
        );
      }
    }

    if (
      (decision === 'rejected' || decision === 'changes_required') &&
      approvedPaise
    ) {
      throw new BadRequestError(
        ErrorCodes.INVALID_AMOUNT,
        'Rejected or changes-required funding decisions cannot include approved amount.',
      );
    }

    const previousStatus = request.status;
    const finalPaise =
      decision === 'approved'
        ? request.requestedPaise
        : decision === 'partially_approved'
          ? approvedPaise
          : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaService;
      const saved = await db.fundingRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          approvedPaise: finalPaise,
          adminNotes: notes,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });

      if (finalPaise) {
        await db.tournament.update({
          where: { id: request.tournamentId },
          data: { prizePoolPaise: finalPaise },
        });
      }

      return saved;
    });

    await this.statusHistory.record({
      resourceType: 'funding_request',
      resourceId: requestId,
      previousStatus,
      newStatus: decision,
      actorId: admin.id,
      reason: notes,
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'funding.review',
      resourceType: 'funding_request',
      resourceId: requestId,
      oldValue: { status: previousStatus },
      newValue: { status: decision, approvedPaise: finalPaise?.toString() },
      reason: notes,
    });

    return updated;
  }

  /** List pending funding requests (admin). */
  async listPending(page: number, limit: number) {
    const where = { status: 'submitted' as const };
    const [items, total] = await Promise.all([
      this.prisma.fundingRequest.findMany({
        where,
        include: {
          tournament: {
            select: { id: true, title: true, mode: true, organizerId: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fundingRequest.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private async getOwnRequest(user: RequestUser, requestId: string) {
    const request = await this.prisma.fundingRequest.findUnique({
      where: { id: requestId },
      include: { tournament: { include: { organizer: true } } },
    });
    if (!request) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Funding request not found.',
      );
    }
    if (request.tournament.organizer.userId !== user.id) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Not your funding request.',
      );
    }
    return request;
  }
}
