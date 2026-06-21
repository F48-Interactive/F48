import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Interceptor.
 * Ensures every request/response has an X-Correlation-ID for tracing.
 * If the client provides one, it's used. Otherwise, a new UUID is generated.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    // Use existing correlation ID or generate a new one
    const correlationId =
      (request.headers['x-correlation-id'] as string) ?? uuidv4();

    // Attach to request for downstream use (logging, audit, etc.)
    (request as FastifyRequest & { correlationId: string }).correlationId =
      correlationId;

    // Mutate headers object so other middleware/guards can read it
    (request.headers as Record<string, string>)['x-correlation-id'] =
      correlationId;

    return next.handle().pipe(
      tap(() => {
        void reply.header('X-Correlation-ID', correlationId);
      }),
    );
  }
}
