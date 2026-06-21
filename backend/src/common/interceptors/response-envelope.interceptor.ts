import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessResponse } from '../../types/api.js';

/**
 * Response Envelope Interceptor.
 * Wraps all successful responses in { success: true, data: ... }
 * Passes through if response already has `success` property (e.g., from controller).
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the controller already returned an envelope, pass through
        if (
          data &&
          typeof data === 'object' &&
          'success' in data
        ) {
          return data as unknown as ApiSuccessResponse<T>;
        }

        // Check if data includes a meta property (e.g., pagination)
        if (
          data &&
          typeof data === 'object' &&
          'meta' in data
        ) {
          const { meta, ...rest } = data as Record<string, unknown>;
          return {
            success: true as const,
            data: rest as T,
            meta: meta as ApiSuccessResponse<T>['meta'],
          };
        }

        return {
          success: true as const,
          data,
        };
      }),
    );
  }
}
