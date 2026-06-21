import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { IDEMPOTENT_KEY } from '../decorators/index.js';
import { PrismaService } from '../../config/database.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BadRequestError, ConflictError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_TTL_HOURS = 24;
const IN_PROGRESS_STATUS = 202;

interface ReservedIdempotencyKey {
  key: string;
  resourceType: string;
  resourceId: string | null;
  responseStatus: number;
  responseBody: Prisma.JsonValue | null;
  expiresAt: Date;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isIdempotent) return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const idempotencyKey = this.getIdempotencyKey(request);
    const resourceType = `${context.getClass().name}.${context.getHandler().name}`;
    const requestFingerprint = this.requestFingerprint(request);

    const existing = await this.reserveOrGetExisting(
      idempotencyKey,
      resourceType,
      requestFingerprint,
    );

    if (existing) {
      if (
        existing.resourceType !== resourceType ||
        existing.resourceId !== requestFingerprint
      ) {
        throw new ConflictError(
          ErrorCodes.IDEMPOTENCY_CONFLICT,
          'Idempotency key was already used for a different request.',
        );
      }

      if (
        existing.responseBody === null &&
        existing.responseStatus === IN_PROGRESS_STATUS
      ) {
        throw new ConflictError(
          ErrorCodes.IDEMPOTENCY_CONFLICT,
          'A request with this idempotency key is already in progress.',
        );
      }

      this.logger.debug(
        { key: idempotencyKey },
        'Returning cached idempotent response',
      );
      void reply.status(existing.responseStatus);
      return new Observable((subscriber) => {
        subscriber.next(existing.responseBody);
        subscriber.complete();
      });
    }

    return next.handle().pipe(
      mergeMap(async (responseBody) => {
        await this.prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            responseStatus: reply.statusCode || 200,
            responseBody: toJson(responseBody),
          },
        });
        return responseBody;
      }),
      catchError((error: unknown) =>
        from(
          this.prisma.idempotencyKey
            .delete({ where: { key: idempotencyKey } })
            .catch(() => undefined),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }

  private getIdempotencyKey(request: FastifyRequest): string {
    const value = request.headers[IDEMPOTENCY_HEADER];

    if (Array.isArray(value) || !value) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'X-Idempotency-Key header is required for this endpoint.',
      );
    }

    const key = value.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'X-Idempotency-Key must be 8-128 safe characters.',
      );
    }

    return key;
  }

  private async reserveOrGetExisting(
    key: string,
    resourceType: string,
    resourceId: string,
  ): Promise<ReservedIdempotencyKey | null> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          resourceType,
          resourceId,
          responseStatus: IN_PROGRESS_STATUS,
          responseBody: null,
          expiresAt,
        },
      });
      return null;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!existing)
      return this.reserveOrGetExisting(key, resourceType, resourceId);

    if (existing.expiresAt < new Date()) {
      await this.prisma.idempotencyKey.delete({ where: { key } });
      return this.reserveOrGetExisting(key, resourceType, resourceId);
    }

    return existing;
  }

  private requestFingerprint(request: FastifyRequest): string {
    return createHash('sha256')
      .update(request.method)
      .update('\n')
      .update(request.url)
      .update('\n')
      .update(stableStringify(request.body ?? null))
      .digest('hex');
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (error as Error & { code?: string }).code === 'P2002';
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
