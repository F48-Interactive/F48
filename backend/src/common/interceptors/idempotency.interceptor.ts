import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { IDEMPOTENT_KEY } from '../decorators/index.js';
import { PrismaService } from '../../config/database.service.js';
import { ConflictError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Idempotency Interceptor (ARCH-006).
 * Ensures financial, registration, result-finalization, and payout commands
 * that may be retried produce the same result.
 *
 * How it works:
 * 1. If endpoint has @Idempotent() and request has X-Idempotency-Key header:
 * 2. Check if key exists in DB → if yes, return cached response
 * 3. If no, process request and cache the response with the key
 */
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

    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER] as
      | string
      | undefined;

    // No key provided — process normally (key is optional)
    if (!idempotencyKey) return next.handle();

    // Check for existing key
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      // Key already used — check if expired
      if (existing.expiresAt < new Date()) {
        // Expired — delete and process fresh
        await this.prisma.idempotencyKey.delete({
          where: { key: idempotencyKey },
        });
      } else {
        // Return cached response
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
    }

    // Process the request and cache the result
    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          const expiresAt = new Date();
          expiresAt.setHours(
            expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS,
          );

          await this.prisma.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              resourceType: context.getClass().name,
              responseStatus: reply.statusCode,
              responseBody: responseBody as Record<string, unknown>,
              expiresAt,
            },
          });
        } catch (error) {
          // Unique constraint = race condition, another request won
          if (
            error instanceof Error &&
            error.message.includes('Unique constraint')
          ) {
            this.logger.warn(
              { key: idempotencyKey },
              'Idempotency key race condition — response not cached',
            );
          } else {
            this.logger.error(
              { error, key: idempotencyKey },
              'Failed to cache idempotent response',
            );
          }
        }
      }),
    );
  }
}
