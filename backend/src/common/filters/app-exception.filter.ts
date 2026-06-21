import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/errors.js';
import type { ApiErrorResponse } from '../../types/api.js';

/**
 * Global exception filter — catches all errors and returns
 * the consistent F48 error envelope (API-002).
 *
 * Handles:
 * - AppError subclasses → mapped error response
 * - NestJS HttpException → mapped error response
 * - Unknown errors → 500 with safe message (no internal leak)
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ?? 'unknown';

    let response: ApiErrorResponse;
    let statusCode: number;

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      response = {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          correlationId,
        },
      };

      if (exception.isOperational) {
        this.logger.warn(
          { code: exception.code, correlationId },
          exception.message,
        );
      } else {
        this.logger.error(
          { code: exception.code, correlationId, stack: exception.stack },
          exception.message,
        );
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message ??
            'Request failed';

      response = {
        success: false,
        error: {
          code: `HTTP_${statusCode}`,
          message: Array.isArray(message) ? message.join(', ') : String(message),
          correlationId,
        },
      };

      this.logger.warn({ statusCode, correlationId }, String(message));
    } else {
      // Unknown error — do NOT expose internals (SEC-005, PLAYER-010)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      response = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          correlationId,
        },
      };

      this.logger.error(
        {
          correlationId,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
        exception instanceof Error
          ? exception.message
          : 'Unknown error',
      );
    }

    void reply.status(statusCode).send(response);
  }
}
