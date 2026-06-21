import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '../../types/api.js';
import { ErrorCodes } from '../constants/error-codes.js';

/**
 * Prisma Exception Filter.
 * Catches Prisma client errors and maps them to user-safe API error responses.
 * Never exposes raw Prisma error details to the client (SEC-005, PLAYER-010).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ?? 'unknown';

    let statusCode: number;
    let response: ApiErrorResponse;

    switch (exception.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (exception.meta?.['target'] as string[]) ?? [];
        statusCode = 409;
        response = {
          success: false,
          error: {
            code: ErrorCodes.DUPLICATE_RESOURCE,
            message: 'A record with this value already exists.',
            details: { fields: target },
            correlationId,
          },
        };
        break;
      }

      // Record not found
      case 'P2025': {
        statusCode = 404;
        response = {
          success: false,
          error: {
            code: ErrorCodes.RESOURCE_NOT_FOUND,
            message: 'The requested resource was not found.',
            correlationId,
          },
        };
        break;
      }

      // Foreign key constraint violation
      case 'P2003': {
        statusCode = 400;
        response = {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_FAILED,
            message: 'Referenced resource does not exist.',
            correlationId,
          },
        };
        break;
      }

      // Default: internal error
      default: {
        statusCode = 500;
        response = {
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'An unexpected database error occurred.',
            correlationId,
          },
        };
        break;
      }
    }

    this.logger.error(
      {
        prismaCode: exception.code,
        correlationId,
        // Do NOT log raw meta in production — may contain field values
        meta: process.env['NODE_ENV'] === 'development' ? exception.meta : undefined,
      },
      `Prisma error: ${exception.code}`,
    );

    void reply.status(statusCode).send(response);
  }
}
